import { test, expect, type Page } from '@playwright/test';

async function seedWeightPickerSession(page: Page): Promise<string> {
  const exerciseRes = await page.request.post('/api/exercises', {
    data: {
      name: 'E2E Weight Picker Squat',
      muscleGroup: 'QUADS',
      category: 'COMPOUND',
      equipmentType: 'BARBELL',
    },
  });
  expect(exerciseRes.ok()).toBeTruthy();
  const exercise = await exerciseRes.json();

  const gymRes = await page.request.post('/api/gyms', {
    data: {
      name: 'E2E Weight Picker Gym',
      dumbbellWeights: [],
      plateWeights: [1.25, 2.5, 5, 10, 20],
      barWeights: [20],
      exerciseConfigs: [{ exerciseId: exercise.id, isAvailable: true, weightOptions: [] }],
      makeActive: true,
    },
  });
  expect(gymRes.ok()).toBeTruthy();
  const gym = await gymRes.json();

  const programRes = await page.request.post('/api/programs', {
    data: { name: 'E2E Weight Picker Program', phase: 'Base' },
  });
  expect(programRes.ok()).toBeTruthy();
  const program = await programRes.json();

  const workoutRes = await page.request.post(`/api/programs/${program.id}/workouts`, {
    data: { name: 'Leg day' },
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
    data: { workoutId: workout.id, gymId: gym.id },
  });
  expect(sessionRes.ok()).toBeTruthy();
  const session = await sessionRes.json();
  return session.id;
}

test('weight picker recenters an off-center option before Apply confirms it', async ({ page }) => {
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.12' },
    data: {
      displayName: 'Weight Picker E2E',
      email: `e2e-weight-picker-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  const sessionId = await seedWeightPickerSession(page);
  await page.goto(`/session/${sessionId}`);

  const weightButton = page.getByRole('button', { name: /weight.*set 1|set 1.*weight/i });
  await weightButton.click();

  const list = page.getByTestId('set-value-options');
  await expect(list).toBeVisible();
  const options = list.locator('[data-picker-option-value]');
  expect(await options.count()).toBeGreaterThan(3);

  const target = options.nth(3);
  const targetValue = Number(await target.getAttribute('data-picker-option-value'));
  expect(Number.isFinite(targetValue)).toBeTruthy();
  await target.click();

  await expect(target).toHaveAttribute('data-picker-selected', 'true');
  await expect(page.getByRole('spinbutton')).toHaveValue(String(targetValue));
  await expect
    .poll(async () => {
      return target.evaluate((element) => {
        const listElement = element.closest('[data-testid="set-value-options"]');
        if (!(listElement instanceof HTMLElement)) return Number.POSITIVE_INFINITY;
        const optionRect = element.getBoundingClientRect();
        const listRect = listElement.getBoundingClientRect();
        return Math.abs(
          optionRect.top + optionRect.height / 2 - (listRect.top + listElement.clientHeight / 2),
        );
      });
    })
    .toBeLessThan(4);

  await page.getByRole('button', { name: /apply value/i }).click();
  await expect(weightButton).toContainText(String(targetValue));
});
