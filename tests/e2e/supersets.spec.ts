import { test, expect, type Page } from '@playwright/test';

// Supersets slice 1 (issue #146): pair two exercises in the program builder
// (A1/A2 labels), then run the workout - the session runner presents the pair
// consecutively with the superset badge, auto-advances A1 -> A2 after a set,
// and Next cycles back into the group while it has sets remaining. Setup data
// is seeded through the authenticated API (the browser context shares cookies
// with page.request).

async function seedPairableWorkout(page: Page): Promise<{
  programId: string;
  workoutId: string;
}> {
  const benchRes = await page.request.post('/api/exercises', {
    data: { name: 'E2E Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  expect(benchRes.ok()).toBeTruthy();
  const bench = await benchRes.json();

  const rowRes = await page.request.post('/api/exercises', {
    data: { name: 'E2E Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND' },
  });
  expect(rowRes.ok()).toBeTruthy();
  const row = await rowRes.json();

  const programRes = await page.request.post('/api/programs', {
    data: { name: 'E2E Superset Program', phase: 'Base' },
  });
  expect(programRes.ok()).toBeTruthy();
  const program = await programRes.json();

  const workoutRes = await page.request.post(`/api/programs/${program.id}/workouts`, {
    data: { name: 'Upper A' },
  });
  expect(workoutRes.ok()).toBeTruthy();
  const workout = await workoutRes.json();

  for (const exercise of [bench, row]) {
    const peRes = await page.request.post(`/api/workouts/${workout.id}/program-exercises`, {
      data: {
        exerciseId: exercise.id,
        targetSets: 2,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetRIR: 2,
        restSec: 15,
      },
    });
    expect(peRes.ok()).toBeTruthy();
  }
  return { programId: program.id, workoutId: workout.id };
}

test('a lifter can pair two exercises as a superset and run the A1/A2 flow', async ({
  page,
}) => {
  // Sign up through the API (fresh user; the cookie lands in the context). A
  // unique X-Forwarded-For keeps this spec in its own register rate-limit
  // bucket.
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.4' },
    data: {
      displayName: 'Superset E2E',
      email: `e2e-superset-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  const { programId, workoutId } = await seedPairableWorkout(page);

  // Builder: pair the second exercise with the previous one.
  await page.goto(`/programs/${programId}`);
  await expect(page.getByText('E2E Row')).toBeVisible();
  await page.getByRole('button', { name: 'Exercise actions' }).nth(1).click();
  await page.getByRole('menuitem', { name: 'Pair with previous' }).click();

  // Both rows now carry their derived superset labels.
  await expect(page.getByText('Superset A1')).toBeVisible();
  await expect(page.getByText('Superset A2')).toBeVisible();

  // Unpair would be offered too (pairing is reversible), but keep the pair.
  // Start a session on the workout.
  const sessionRes = await page.request.post('/api/sessions', {
    data: { workoutId },
  });
  expect(sessionRes.ok()).toBeTruthy();
  const session = await sessionRes.json();

  // Runner: A1 first, with the superset badge.
  await page.goto(`/session/${session.id}`);
  await expect(page.getByText('Superset A1')).toBeVisible();
  await expect(page.getByText(/Exercise 1\/2 · E2E Bench/)).toBeVisible();

  // Log a working set on A1; after the rest, the runner auto-advances to A2
  // (the alternating superset flow), not to a second bench set.
  await page.getByLabel('Quick entry').fill('60x8@2');
  await page.getByRole('button', { name: /log the set/i }).click();
  await page.getByRole('button', { name: /skip/i }).click();
  await expect(page.getByText('Superset A2')).toBeVisible();
  await expect(page.getByText(/Exercise 2\/2 · E2E Row/)).toBeVisible();

  // Next from the last member cycles back into the group while sets remain.
  await page.getByRole('button', { name: /next/i }).click();
  await expect(page.getByText('Superset A1')).toBeVisible();
  await expect(page.getByText(/Exercise 1\/2 · E2E Bench/)).toBeVisible();
});
