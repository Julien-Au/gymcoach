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

  it.each([0, -5, 19.9, 301, 'abc', null, undefined])(
    'rejects invalid weight %p',
    (weightKg) => {
      expect(bodyweightEntryInputSchema.safeParse({ weightKg }).success).toBe(false);
    },
  );

  it('accepts the profile-route bounds (20-300 kg)', () => {
    expect(bodyweightEntryInputSchema.safeParse({ weightKg: 20 }).success).toBe(true);
    expect(bodyweightEntryInputSchema.safeParse({ weightKg: 300 }).success).toBe(true);
  });

  it('rejects an oversized note', () => {
    const res = bodyweightEntryInputSchema.safeParse({
      weightKg: 80,
      note: 'x'.repeat(501),
    });
    expect(res.success).toBe(false);
  });
});
