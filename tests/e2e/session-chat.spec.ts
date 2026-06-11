import { test, expect, type Page } from '@playwright/test';

// Ask the coach mid-session (issue #111): from the session runner, the lifter
// opens the chat with the live session attached and gets an answer grounded in
// it. The E2E server runs LLM_PROVIDER=demo, so the streamed reply is the
// canned in-session response - which proves the currentSession section reached
// the provider (the demo keys on the quoted "currentSession" payload marker).

async function seedRunningSession(page: Page): Promise<string> {
  const exerciseRes = await page.request.post('/api/exercises', {
    data: { name: 'Chat Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  expect(exerciseRes.ok()).toBeTruthy();
  const exercise = await exerciseRes.json();

  const programRes = await page.request.post('/api/programs', {
    data: { name: 'E2E Chat Program', phase: 'Base' },
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
  return session.id as string;
}

test('a lifter can ask the coach mid-session with the live workout attached', async ({
  page,
}) => {
  // Sign up through the API (fresh user each run; the response cookie lands in
  // the shared browser context). A unique X-Forwarded-For keeps this spec in
  // its own register rate-limit bucket: the suite's parallel UI signups
  // already use up the 5/min per-IP budget, and this flow is not about signup.
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.1' },
    data: {
      displayName: 'Chat E2E',
      email: `e2e-session-chat-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();
  await page.goto('/');

  const sessionId = await seedRunningSession(page);

  // The session runner offers the in-session coach entry point.
  await page.goto(`/session/${sessionId}`);
  await expect(page.getByText('Chat Bench').first()).toBeVisible();
  await page.getByRole('link', { name: 'Ask the coach' }).click();

  // Chat opens with the live session attached and a fresh conversation.
  await expect(page).toHaveURL(new RegExp(`/chat\\?sessionId=${sessionId}`));
  await expect(page.getByText('Live session attached.')).toBeVisible();

  // Ask a mid-workout question: the demo provider streams the in-session
  // canned answer, proving the currentSession context reached the LLM call.
  await page.getByPlaceholder('Message your coach...').fill('My shoulder feels off, what now?');
  await page.getByPlaceholder('Message your coach...').press('Enter');
  await expect(page.getByText('looking at your live session')).toBeVisible({ timeout: 15_000 });
});
