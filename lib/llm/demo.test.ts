import { describe, it, expect, afterEach } from 'vitest';
import { getLlmProvider, resolveProviderId } from './index';

const saved = process.env.LLM_PROVIDER;
afterEach(() => {
  if (saved === undefined) delete process.env.LLM_PROVIDER;
  else process.env.LLM_PROVIDER = saved;
});

describe('demo provider', () => {
  it('is selected by LLM_PROVIDER=demo and is always configured', () => {
    process.env.LLM_PROVIDER = 'demo';
    expect(resolveProviderId()).toBe('demo');
    const p = getLlmProvider();
    expect(p.id).toBe('demo');
    expect(p.isConfigured()).toBe(true);
  });

  it('routes the canned response based on the system prompt', async () => {
    process.env.LLM_PROVIDER = 'demo';
    const p = getLlmProvider();

    const debrief = await p.complete({
      system: 'You produce a debrief and an <adjustments> block.',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(debrief.text).toContain('<adjustments>');
    // Issue #101: the canned debrief demonstrates the goals + fatigue payload
    // fields so the no-key flow shows the behavior.
    expect(debrief.text).toMatch(/of the way to your .* target/i);
    expect(debrief.text).toMatch(/stalled/i);
    expect(debrief.text).toMatch(/deload/i);

    const program = await p.complete({
      system: 'Respond with a SINGLE JSON object and nothing else.',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(program.text).toContain('"workouts"');

    const chat = await p.complete({
      system: 'You are GymCoach, a conversational coach.',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(chat.text.toLowerCase()).toContain('volume');
  });

  // Issue #111: a live session in the appended payload selects the in-session
  // canned answer, so the no-key flow demonstrates mid-workout coaching.
  it('serves the in-session answer when the payload carries a currentSession section', async () => {
    process.env.LLM_PROVIDER = 'demo';
    const p = getLlmProvider();

    const inSession = await p.complete({
      // Mimics the chat route: stable prompt (mentions currentSession without
      // quotes) + JSON payload where the quoted key appears.
      system:
        'You are GymCoach. When the JSON contains a currentSession section...\n{ "currentSession": { "workoutName": "Push" } }',
      messages: [{ role: 'user', content: 'shoulder feels off' }],
    });
    expect(inSession.text).toContain('live session');
    expect(inSession.text).not.toContain('<adjustments>');

    // Without the quoted JSON key (prompt prose alone) it stays the normal
    // chat answer - the marker must not false-positive on the stable prompt.
    const normal = await p.complete({
      system: 'You are GymCoach. When the JSON contains a currentSession section...',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(normal.text.toLowerCase()).toContain('volume');
  });
});
