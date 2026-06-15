import { test, expect, type Page } from '@playwright/test';

// Free-text (AI-parsed) set logging (issue #210): from the session runner, the
// lifter types a plain-language set description, clicks "Parse with AI", the
// form fills, and they confirm with the existing Log button. The E2E server
// runs LLM_PROVIDER=demo, so the parse is the canned strength result
// ({ weight: 100, reps: 8, rir: 2 }) - which proves the parse round-trip works
// end to end without auto-logging.

async function seedStrengthWorkout(page: Page): Promise<{ sessionId: string }> {
  const exerciseRes = await page.request.post('/api/exercises', {
    data: { name: 'E2E Parse Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  expect(exerciseRes.ok()).toBeTruthy();
  const exercise = await exerciseRes.json();

  const programRes = await page.request.post('/api/programs', {
    data: { name: 'E2E Parse Program', phase: 'Base' },
  });
  expect(programRes.ok()).toBeTruthy();
  const program = await programRes.json();

  const workoutRes = await page.request.post(`/api/programs/${program.id}/workouts`, {
    data: { name: 'Push day' },
  });
  expect(workoutRes.ok()).toBeTruthy();
  const workout = await workoutRes.json();

  const peRes = await page.request.post(`/api/workouts/${workout.id}/program-exercises`, {
    data: {
      exerciseId: exercise.id,
      targetSets: 3,
      targetRepsMin: 6,
      targetRepsMax: 10,
      targetRIR: 2,
      restSec: 90,
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

test('a lifter can fill the set form from free text via Parse with AI', async ({
  page,
}) => {
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.9' },
    data: {
      displayName: 'Parse E2E',
      email: `e2e-ai-parse-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  const { sessionId } = await seedStrengthWorkout(page);

  await page.goto(`/session/${sessionId}`);
  await expect(page.getByLabel(/describe the set/i)).toBeVisible();

  // Type free text and parse it with AI.
  await page.getByLabel(/describe the set/i).fill('100 kg for 8, 2 in the tank');
  await page.getByRole('button', { name: /parse with ai/i }).click();

  // The form fills from the canned demo parse: load 100, reps 8.
  const loadInput = page.locator('input[type="number"]').first();
  await expect(loadInput).toHaveValue('100', { timeout: 15_000 });

  // Nothing is logged until the lifter confirms; now confirm.
  await page.getByRole('button', { name: /log the set/i }).click();

  // The logged set renders in the sets list (100 kg x 8).
  await expect(page.getByText(/100/).first()).toBeVisible();
});
