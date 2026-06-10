import { describe, it, expect } from 'vitest';
import { goalInputSchema } from './goal';

const valid = { exerciseId: 'e1', targetWeight: 100, targetReps: 5 };

describe('goalInputSchema', () => {
  it('accepts a valid goal', () => {
    expect(goalInputSchema.parse(valid)).toEqual(valid);
  });

  it('coerces numeric strings (form payloads)', () => {
    const parsed = goalInputSchema.parse({
      exerciseId: 'e1',
      targetWeight: '62.5',
      targetReps: '8',
    });
    expect(parsed.targetWeight).toBe(62.5);
    expect(parsed.targetReps).toBe(8);
  });

  it('rejects a missing or empty exerciseId', () => {
    expect(goalInputSchema.safeParse({ ...valid, exerciseId: '' }).success).toBe(false);
    const { exerciseId: _omitted, ...rest } = valid;
    expect(goalInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects non-positive or out-of-range weight', () => {
    expect(goalInputSchema.safeParse({ ...valid, targetWeight: 0 }).success).toBe(false);
    expect(goalInputSchema.safeParse({ ...valid, targetWeight: -10 }).success).toBe(false);
    expect(goalInputSchema.safeParse({ ...valid, targetWeight: 1001 }).success).toBe(false);
  });

  it('rejects zero, negative, decimal, or out-of-range reps', () => {
    expect(goalInputSchema.safeParse({ ...valid, targetReps: 0 }).success).toBe(false);
    expect(goalInputSchema.safeParse({ ...valid, targetReps: -1 }).success).toBe(false);
    expect(goalInputSchema.safeParse({ ...valid, targetReps: 5.5 }).success).toBe(false);
    expect(goalInputSchema.safeParse({ ...valid, targetReps: 101 }).success).toBe(false);
  });
});
