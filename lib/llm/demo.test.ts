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
});
