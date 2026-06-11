import { describe, it, expect } from 'vitest';
import { CHAT_SYSTEM_PROMPT } from './chat-system-prompt';

// Issue #111: the in-session context guidance is INPUT-side only. The chat
// stays free-form text; it must never grow a structured output contract.

describe('chat system prompt', () => {
  it('tells the coach how to use the live currentSession section', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/currentSession/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/mid-workout/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/immediately actionable/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/staying within the user's program/i);
  });

  it('defines no structured output contract (free-form text only)', () => {
    expect(CHAT_SYSTEM_PROMPT).not.toContain('<adjustments>');
    expect(CHAT_SYSTEM_PROMPT).not.toMatch(/JSON object/i);
  });
});
