import { describe, it, expect } from 'vitest';
import { deriveConversationTitle } from './chat';

describe('deriveConversationTitle', () => {
  it('keeps a short message as-is', () => {
    expect(deriveConversationTitle('How is my bench progressing?')).toBe(
      'How is my bench progressing?',
    );
  });

  it('collapses whitespace', () => {
    expect(deriveConversationTitle('  hello   world  ')).toBe('hello world');
  });

  it('truncates long messages with an ellipsis', () => {
    const long = 'a'.repeat(100);
    const title = deriveConversationTitle(long);
    expect(title.endsWith('...')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it('falls back for an empty message', () => {
    expect(deriveConversationTitle('   ')).toBe('New conversation');
  });
});
