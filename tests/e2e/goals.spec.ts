import { test, expect, type Page } from '@playwright/test';

// Per-exercise target goals (issue #90): set a goal on the progress page,
// watch the progress bar, reach it, see the achieved badge, remove it.
// Data is seeded through the authenticated API (the browser context shares
// cookies with page.request), which keeps the test fast and deterministic.

async function seedLoggedSet(page: Page) {
  // One exercise, one program/workout, one finished session with a 90x5 set.
  const exerciseRes = await page.request.post('/api/exercises', {
    data: { name: 'Goal Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  expect(exerciseRes.ok()).toBeTruthy();
  const exercise = await exerciseRes.json();

  const programRes = await page.request.post('/api/programs', {
    data: { name: 'E2E Program', phase: 'Base' },
  });
  expect(programRes.ok()).toBeTruthy();
  const program = await programRes.json();

  const workoutRes = await page.request.post(`/api/programs/${program.id}/workouts`, {
    data: { name: 'Day A' },
  });
  expect(workoutRes.ok()).toBeTruthy();
  const workout = await workoutRes.json();

  const sessionRes = await page.request.post('/api/sessions', {
    data: { workoutId: workout.id },
  });
  expect(sessionRes.ok()).toBeTruthy();
  const session = await sessionRes.json();

  const setRes = await page.request.post(`/api/sessions/${session.id}/sets`, {
    data: { exerciseId: exercise.id, setNumber: 1, weight: 90, reps: 5 },
  });
  expect(setRes.ok()).toBeTruthy();

  const finishRes = await page.request.put(`/api/sessions/${session.id}`, {
    data: { finish: true },
  });
  expect(finishRes.ok()).toBeTruthy();
}

test('a lifter can set, track, achieve, and remove an exercise goal', async ({ page }) => {
  // Sign up (fresh user each run).
  await page.goto('/signup');
  await page.getByLabel('Name').fill('Goal E2E');
  await page.getByLabel('Email').fill(`e2e-goals-${Date.now()}@test.dev`);
  await page.getByLabel('Password').fill('supersecret');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/');

  await seedLoggedSet(page);

  // Set a goal of 100x5: the 90x5 best (e1RM 105 vs 116.7) is 90% there.
  await page.goto('/progress');
  await expect(page.getByText('Goal - Goal Bench')).toBeVisible();
  await page.getByRole('button', { name: 'Set a goal' }).click();
  await page.getByLabel(/target load/i).fill('100');
  await page.getByLabel(/target reps/i).fill('5');
  await page.getByRole('button', { name: 'Save goal' }).click();

  await expect(page.getByText(/90% of the target/i)).toBeVisible();
  await expect(page.getByText('Achieved')).not.toBeVisible();

  // Lower the target to 80x3: the existing 90x5 set already beats it.
  await page.getByRole('button', { name: 'Edit goal' }).click();
  await page.getByLabel(/target load/i).fill('80');
  await page.getByLabel(/target reps/i).fill('3');
  await page.getByRole('button', { name: 'Save goal' }).click();

  await expect(page.getByText('Achieved')).toBeVisible();
  await expect(page.getByText(/100% of the target/i)).toBeVisible();

  // Remove the goal.
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText(/no goal set for this exercise/i)).toBeVisible();
});
