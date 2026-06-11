import { test, expect, type Page } from '@playwright/test';

// First-class cardio sets (issue #133): a CARDIO exercise can be put in a
// workout, a duration(+distance) set logged through the session runner, and
// the result renders as duration/distance in the summary and the history.
// Setup data is seeded through the authenticated API (the browser context
// shares cookies with page.request).

async function seedCardioWorkout(page: Page): Promise<{ sessionId: string }> {
  const exerciseRes = await page.request.post('/api/exercises', {
    data: { name: 'E2E Running', muscleGroup: 'OTHER', category: 'CARDIO' },
  });
  expect(exerciseRes.ok()).toBeTruthy();
  const exercise = await exerciseRes.json();

  const programRes = await page.request.post('/api/programs', {
    data: { name: 'E2E Cardio Program', phase: 'Base' },
  });
  expect(programRes.ok()).toBeTruthy();
  const program = await programRes.json();

  const workoutRes = await page.request.post(`/api/programs/${program.id}/workouts`, {
    data: { name: 'Conditioning' },
  });
  expect(workoutRes.ok()).toBeTruthy();
  const workout = await workoutRes.json();

  const peRes = await page.request.post(`/api/workouts/${workout.id}/program-exercises`, {
    data: {
      exerciseId: exercise.id,
      targetSets: 1,
      targetRepsMin: 1,
      targetRepsMax: 1,
      targetRIR: 0,
      restSec: 60,
    },
  });
  expect(peRes.ok()).toBeTruthy();

  const sessionRes = await page.request.post('/api/sessions', {
    data: { workoutId: workout.id },
  });
  expect(sessionRes.ok()).toBeTruthy();
  const session = await sessionRes.json();
  return { sessionId: session.id };
}

test('a trainee can log a cardio set (duration + distance) in a live session', async ({
  page,
}) => {
  // Sign up through the API (fresh user; the cookie lands in the context). A
  // unique X-Forwarded-For keeps this spec in its own register rate-limit
  // bucket - the suite's UI signups use up the 5/min per-IP budget.
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.3' },
    data: {
      displayName: 'Cardio E2E',
      email: `e2e-cardio-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  const { sessionId } = await seedCardioWorkout(page);

  // The session runner shows the cardio logger: duration/distance, no
  // weight/reps machinery.
  await page.goto(`/session/${sessionId}`);
  await expect(page.getByLabel(/duration/i)).toBeVisible();
  await expect(page.getByLabel(/distance/i)).toBeVisible();
  await expect(page.getByLabel('Quick entry')).not.toBeVisible();

  await page.getByLabel(/duration/i).fill('12:30');
  await page.getByLabel(/distance/i).fill('2.5');
  await page.getByRole('button', { name: /log the set/i }).click();

  // The logged set renders as duration/distance in the sets list.
  await expect(page.getByText('12:30 · 2.5 km')).toBeVisible();

  // The post-session summary shows the cardio totals for the exercise.
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Session summary')).toBeVisible();
  await expect(page.getByText(/1\/1 sets · 12:30 · 2\.5 km/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish the session' }).click();
  await expect(page).toHaveURL('/');

  // History renders the cardio set as duration/distance, not weight x reps.
  await page.goto(`/history/${sessionId}`);
  await expect(page.getByText('Total: 12:30 · 2.5 km')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Duration' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Load' })).not.toBeVisible();
});
