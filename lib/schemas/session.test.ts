import { describe, it, expect } from 'vitest';
import { sessionStartSchema, sessionUpdateSchema } from './session';

describe('sessionStartSchema', () => {
  it('requires a non-empty workoutId', () => {
    expect(sessionStartSchema.parse({ workoutId: 'w1' }).workoutId).toBe('w1');
    expect(sessionStartSchema.safeParse({ workoutId: '' }).success).toBe(false);
    expect(sessionStartSchema.safeParse({}).success).toBe(false);
  });
});

describe('sessionUpdateSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(sessionUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('trims notes and accepts a finish flag', () => {
    const parsed = sessionUpdateSchema.parse({ notes: '  good session  ', finish: true });
    expect(parsed.notes).toBe('good session');
    expect(parsed.finish).toBe(true);
  });

  it('rejects notes longer than 2000 characters', () => {
    expect(sessionUpdateSchema.safeParse({ notes: 'x'.repeat(2001) }).success).toBe(false);
  });
});
