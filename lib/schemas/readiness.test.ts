import { describe, it, expect } from 'vitest';
import { readinessCheckinInputSchema } from './readiness';

describe('readinessCheckinInputSchema', () => {
  it('accepts a minimal valid check-in', () => {
    const r = readinessCheckinInputSchema.safeParse({ readiness: 4, sleepQuality: 3 });
    expect(r.success).toBe(true);
  });

  it('accepts per-muscle-group soreness on a 1-5 scale', () => {
    const r = readinessCheckinInputSchema.safeParse({
      readiness: 3,
      sleepQuality: 4,
      soreness: { QUADS: 5, CHEST: 2 },
      note: 'legs are toast',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.soreness).toEqual({ QUADS: 5, CHEST: 2 });
  });

  it('rejects readiness outside 1-5', () => {
    expect(readinessCheckinInputSchema.safeParse({ readiness: 0, sleepQuality: 3 }).success).toBe(false);
    expect(readinessCheckinInputSchema.safeParse({ readiness: 6, sleepQuality: 3 }).success).toBe(false);
  });

  it('rejects sleepQuality outside 1-5', () => {
    expect(readinessCheckinInputSchema.safeParse({ readiness: 3, sleepQuality: 9 }).success).toBe(false);
  });

  it('rejects a soreness value outside 1-5', () => {
    const r = readinessCheckinInputSchema.safeParse({
      readiness: 3,
      sleepQuality: 3,
      soreness: { QUADS: 7 },
    });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown muscle group key', () => {
    const r = readinessCheckinInputSchema.safeParse({
      readiness: 3,
      sleepQuality: 3,
      soreness: { NOT_A_MUSCLE: 3 },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-integer rating', () => {
    expect(readinessCheckinInputSchema.safeParse({ readiness: 2.5, sleepQuality: 3 }).success).toBe(false);
  });

  it('caps the note length', () => {
    const r = readinessCheckinInputSchema.safeParse({
      readiness: 3,
      sleepQuality: 3,
      note: 'x'.repeat(501),
    });
    expect(r.success).toBe(false);
  });
});
