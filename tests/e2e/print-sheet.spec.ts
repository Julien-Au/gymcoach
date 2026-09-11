import { test, expect } from '@playwright/test';

// Printable A4 workout sheet (issue #333): the print route renders a seeded
// program workout with an empty weight / reps / RIR cell per planned set, and
// `?workout=` narrows it to one session. Setup data goes through the
// authenticated API (page.request shares the browser context's cookies).

test('the print route renders a seeded program as fillable sheets', async ({ page }) => {
  // Fresh user; a unique X-Forwarded-For keeps this spec in its own register
  // rate-limit bucket.
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.1.6' },
    data: {
      displayName: 'Print E2E',
      email: `e2e-print-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  const benchRes = await page.request.post('/api/exercises', {
    data: { name: 'E2E Print Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  expect(benchRes.ok()).toBeTruthy();
  const bench = await benchRes.json();
  const rowRes = await page.request.post('/api/exercises', {
    data: { name: 'E2E Print Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND' },
  });
  expect(rowRes.ok()).toBeTruthy();
  const row = await rowRes.json();

  const programRes = await page.request.post('/api/programs', {
    data: { name: 'E2E Print Program', phase: 'Base' },
  });
  expect(programRes.ok()).toBeTruthy();
  const program = await programRes.json();

  const workoutIds: string[] = [];
  for (const [name, exercises] of [
    ['Upper A', [bench, row]],
    ['Upper B', [bench]],
  ] as const) {
    const workoutRes = await page.request.post(`/api/programs/${program.id}/workouts`, {
      data: { name },
    });
    expect(workoutRes.ok()).toBeTruthy();
    const workout = await workoutRes.json();
    workoutIds.push(workout.id);
    for (const exercise of exercises) {
      const peRes = await page.request.post(`/api/workouts/${workout.id}/program-exercises`, {
        data: {
          exerciseId: exercise.id,
          targetSets: 3,
          targetRepsMin: 8,
          targetRepsMax: 12,
          targetRIR: 2,
          restSec: 90,
        },
      });
      expect(peRes.ok()).toBeTruthy();
    }
  }

  // The program page offers the sheet.
  await page.goto(`/programs/${program.id}`);
  await page.getByRole('link', { name: 'Print sheet' }).click();
  await expect(page).toHaveURL(`/programs/${program.id}/print`);

  // Whole program: one sheet per workout, every exercise with 3 sets x 3 cells.
  await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upper B' })).toBeVisible();
  await expect(page.getByText('E2E Print Bench')).toHaveCount(2);
  await expect(page.getByText('E2E Print Row')).toHaveCount(1);
  await expect(page.locator('[data-print-sheet]')).toHaveCount(2);
  await expect(page.locator('[data-print-cell]')).toHaveCount(27);
  await expect(page.getByText('3 x 8-12 reps, RIR 2').first()).toBeVisible();
  // The app chrome is not part of the sheet route.
  await expect(page.getByRole('link', { name: 'GymCoach' })).toHaveCount(0);

  // One workout only.
  await page.goto(`/programs/${program.id}/print?workout=${workoutIds[1]}`);
  await expect(page.getByRole('heading', { name: 'Upper B' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upper A' })).toHaveCount(0);
  await expect(page.locator('[data-print-cell]')).toHaveCount(9);

  // Print media: the screen-only toolbar disappears, the sheet stays.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Print' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Upper B' })).toBeVisible();

  // An unknown workout id is a 404, not an empty sheet.
  const missing = await page.goto(`/programs/${program.id}/print?workout=nope`);
  expect(missing?.status()).toBe(404);

  // So is an empty `?workout=`: it never silently widens to the whole program.
  const empty = await page.goto(`/programs/${program.id}/print?workout=`);
  expect(empty?.status()).toBe(404);
});
