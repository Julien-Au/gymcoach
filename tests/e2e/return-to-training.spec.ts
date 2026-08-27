import { expect, test, type Page } from '@playwright/test';
import { Client } from 'pg';

test.use({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'x-forwarded-for': '10.111.1.91' } });

async function seedReturnScenario(page: Page) {
  const email = 'e2e-return-' + Date.now() + '@test.dev';
  const password = 'supersecret';
  const register = await page.request.post('/api/auth/register', {
    data: { displayName: 'Return E2E', email, password },
  });
  expect(register.ok()).toBeTruthy();

  const exerciseResponse = await page.request.post('/api/exercises', {
    data: {
      name: 'E2E Return Barbell Press',
      muscleGroup: 'CHEST',
      category: 'COMPOUND',
      equipmentType: 'BARBELL',
    },
  });
  expect(exerciseResponse.ok()).toBeTruthy();
  const exercise = await exerciseResponse.json();

  const gymResponse = await page.request.post('/api/gyms', {
    data: {
      name: 'E2E Return Gym',
      dumbbellWeights: [],
      plateWeights: [5, 10],
      barWeights: [20],
      exerciseConfigs: [{ exerciseId: exercise.id, isAvailable: true, weightOptions: [] }],
      makeActive: true,
    },
  });
  expect(gymResponse.ok()).toBeTruthy();
  const gym = await gymResponse.json();

  const programResponse = await page.request.post('/api/programs', {
    data: { name: 'E2E Return Program', phase: 'Base' },
  });
  expect(programResponse.ok()).toBeTruthy();
  const program = await programResponse.json();

  const workoutResponse = await page.request.post('/api/programs/' + program.id + '/workouts', {
    data: { name: 'Return day' },
  });
  expect(workoutResponse.ok()).toBeTruthy();
  const workout = await workoutResponse.json();

  const programExerciseResponse = await page.request.post(
    '/api/workouts/' + workout.id + '/program-exercises',
    {
      data: {
        exerciseId: exercise.id,
        targetSets: 4,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetRIR: 2,
        restSec: 120,
      },
    },
  );
  expect(programExerciseResponse.ok()).toBeTruthy();

  const dbUrl =
    process.env.DATABASE_URL ??
    process.env.E2E_DATABASE_URL ??
    'postgresql://gymcoach_test:gymcoach_test@localhost:5434/gymcoach_test';
  const sql = new Client({ connectionString: dbUrl });
  await sql.connect();
  try {
    const now = Date.now();
    for (const [index, age] of [180, 210, 240].entries()) {
      const historicalResponse = await page.request.post('/api/sessions', {
        data: { workoutId: workout.id, gymId: gym.id },
      });
      expect(historicalResponse.ok()).toBeTruthy();
      const historical = await historicalResponse.json();

      const setResponse = await page.request.post('/api/sessions/' + historical.id + '/sets', {
        data: {
          exerciseId: exercise.id,
          setNumber: 1,
          weight: [60, 70, 80][index]!,
          reps: 8,
          rir: 2,
          isWarmup: false,
          isDropSet: false,
        },
      });
      expect(setResponse.ok()).toBeTruthy();

      const finishResponse = await page.request.put('/api/sessions/' + historical.id, {
        data: { finish: true },
      });
      expect(finishResponse.ok()).toBeTruthy();

      const startedAt = new Date(now - age * 86_400_000);
      const finishedAt = new Date(startedAt.getTime() + 3_600_000);
      const completedAt = new Date(startedAt.getTime() + 60_000);
      await sql.query(
        'UPDATE "Session" SET "startedAt" = $1, "finishedAt" = $2 WHERE id = $3',
        [startedAt, finishedAt, historical.id],
      );
      await sql.query('UPDATE "Set" SET "completedAt" = $1 WHERE "sessionId" = $2', [
        completedAt,
        historical.id,
      ]);
    }
  } finally {
    await sql.end();
  }

  const sessionResponse = await page.request.post('/api/sessions', {
    data: { workoutId: workout.id, gymId: gym.id },
  });
  expect(sessionResponse.ok()).toBeTruthy();
  const session = await sessionResponse.json();
  return { sessionId: session.id as string };
}

test('a long break activates a conservative first working set without replacing normal progression', async ({ page }) => {
  const { sessionId } = await seedReturnScenario(page);
  await page.goto('/session/' + sessionId);

  const notice = page.getByTestId('return-to-training-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Sets today: 1. Target RIR: 4.');
  await expect(notice).toContainText('Conservative starting load: 40 kg.');

  const loadInput = page.locator('input[type="number"]').first();
  await expect(loadInput).toHaveValue('40');
  await expect(page.getByRole('switch', { name: 'Drop set' })).toBeDisabled();
});
