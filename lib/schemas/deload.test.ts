import { describe, it, expect } from 'vitest';
import { deloadStartSchema } from './deload';

describe('deloadStartSchema', () => {
  it('accepts the bare empty object the UI sends', () => {
    expect(deloadStartSchema.safeParse({}).success).toBe(true);
  });

  it('rejects unexpected fields (no client-chosen duration)', () => {
    expect(deloadStartSchema.safeParse({ days: 30 }).success).toBe(false);
    expect(deloadStartSchema.safeParse({ deloadUntil: '2099-01-01' }).success).toBe(false);
  });

  it('rejects non-object bodies', () => {
    expect(deloadStartSchema.safeParse(null).success).toBe(false);
    expect(deloadStartSchema.safeParse('start').success).toBe(false);
    expect(deloadStartSchema.safeParse(7).success).toBe(false);
  });
});
