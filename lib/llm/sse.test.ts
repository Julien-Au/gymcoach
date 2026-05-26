import { describe, it, expect } from 'vitest';
import { extractOpenRouterDelta } from './openrouter';

describe('extractOpenRouterDelta', () => {
  it('extracts the content delta from a data line', () => {
    const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
    expect(extractOpenRouterDelta(line)).toBe('Hello');
  });

  it('returns null for the [DONE] sentinel', () => {
    expect(extractOpenRouterDelta('data: [DONE]')).toBeNull();
  });

  it('returns null for non-data lines and keep-alives', () => {
    expect(extractOpenRouterDelta(': keep-alive')).toBeNull();
    expect(extractOpenRouterDelta('')).toBeNull();
    expect(extractOpenRouterDelta('event: ping')).toBeNull();
  });

  it('returns null when the delta has no content (e.g. role-only chunk)', () => {
    expect(extractOpenRouterDelta('data: {"choices":[{"delta":{"role":"assistant"}}]}')).toBeNull();
  });

  it('returns null on malformed JSON instead of throwing', () => {
    expect(extractOpenRouterDelta('data: {not json')).toBeNull();
  });
});
