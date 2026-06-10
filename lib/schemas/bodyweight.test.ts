import { describe, it, expect } from 'vitest';
import { bodyweightEntryInputSchema } from './bodyweight';

describe('bodyweightEntryInputSchema', () => {
  it('accepts a plain weight in kg', () => {
    const parsed = bodyweightEntryInputSchema.parse({ weightKg: 82.4 });
    expect(parsed.weightKg).toBe(82.4);
    expect(parsed.note).toBeUndefined();
  });

  it('accepts an optional note', () => {
    const parsed = bodyweightEntryInputSchema.parse({
      weightKg: 80,
      note: 'morning, fasted',
    });
    expect(parsed.note).toBe('morning, fasted');
  });

  it('coerces a numeric string', () => {
    expect(bodyweightEntryInputSchema.parse({ weightKg: '75.5' }).weightKg).toBe(75.5);
  });

  it.each([0, -5, 501, 'abc', null, undefined])(
    'rejects invalid weight %p',
    (weightKg) => {
      expect(bodyweightEntryInputSchema.safeParse({ weightKg }).success).toBe(false);
    },
  );

  it('rejects an oversized note', () => {
    const res = bodyweightEntryInputSchema.safeParse({
      weightKg: 80,
      note: 'x'.repeat(501),
    });
    expect(res.success).toBe(false);
  });
});
