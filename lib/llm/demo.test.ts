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
    // Issue #212: the canned debrief references an all-time record so the no-key
    // flow exercises the records payload field.
    expect(debrief.text).toMatch(/personal record|PR|all-time best/i);

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

  // Issue #145: the canned debrief exercises the conditioning payload section
  // so the no-key flow demonstrates the coach reading cardio volume.
  it('references the conditioning numbers in the canned debrief', async () => {
    process.env.LLM_PROVIDER = 'demo';
    const p = getLlmProvider();

    const debrief = await p.complete({
      system: 'You produce a debrief and an <adjustments> block.',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(debrief.text).toMatch(/\*\*Conditioning\*\*/);
    expect(debrief.text).toMatch(/150 weekly target minutes/i);
    expect(debrief.text).toMatch(/cardio sessions/i);
    // The conditioning section must not displace the output contract: the
    // <adjustments> block still closes the response.
    expect(debrief.text.trimEnd().endsWith('</adjustments>')).toBe(true);
  });

  // Issue #153: the canned debrief exercises the interference guidance so the
  // no-key flow demonstrates the coach reasoning about cardio timing.
  it('includes an interference-aware line in the canned debrief', async () => {
    process.env.LLM_PROVIDER = 'demo';
    const p = getLlmProvider();

    const debrief = await p.complete({
      system: 'You produce a debrief and an <adjustments> block.',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(debrief.text).toMatch(/Interference check/i);
    expect(debrief.text).toMatch(/move hard runs away from heavy lower-body days/i);
    // Still ends with the unchanged output contract.
    expect(debrief.text.trimEnd().endsWith('</adjustments>')).toBe(true);
  });

  // Issue #188: the canned debrief references the user's free-text note to the
  // coach so the no-key flow demonstrates the correctable-memory behavior.
  it('acknowledges the user note to the coach in the canned debrief', async () => {
    process.env.LLM_PROVIDER = 'demo';
    const p = getLlmProvider();

    const debrief = await p.complete({
      system: 'You produce a debrief and an <adjustments> block.',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(debrief.text).toMatch(/Your note to me/i);
    expect(debrief.text).toMatch(/go easy on pressing/i);
    // The note line must not displace the output contract.
    expect(debrief.text.trimEnd().endsWith('</adjustments>')).toBe(true);
  });
});
