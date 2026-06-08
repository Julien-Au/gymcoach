import { describe, it, expect } from 'vitest';
import { setInputSchema } from './set';

describe('setInputSchema', () => {
  const valid = { exerciseId: 'ex1', setNumber: 1, weight: 60, reps: 10 };

  it('accepts a minimal valid set and applies boolean defaults', () => {
    const parsed = setInputSchema.parse(valid);
    expect(parsed.isWarmup).toBe(false);
    expect(parsed.isDropSet).toBe(false);
  });

  it('coerces numeric strings', () => {
    const parsed = setInputSchema.parse({
      exerciseId: 'ex1',
      setNumber: '2',
      weight: '82.5',
      reps: '8',
    });
    expect(parsed.setNumber).toBe(2);
    expect(parsed.weight).toBe(82.5);
    expect(parsed.reps).toBe(8);
  });

  it('allows weight 0 (bodyweight) and a null rir', () => {
    expect(setInputSchema.parse({ ...valid, weight: 0, rir: null }).rir).toBeNull();
  });

  it('rejects an empty exerciseId', () => {
    expect(setInputSchema.safeParse({ ...valid, exerciseId: '' }).success).toBe(false);
  });

  it('rejects out-of-range weight, reps, setNumber, and rir', () => {
    expect(setInputSchema.safeParse({ ...valid, weight: 501 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, weight: -1 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, reps: 101 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, setNumber: 0 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, rir: 6 }).success).toBe(false);
  });

  it('rejects non-integer reps and setNumber', () => {
    expect(setInputSchema.safeParse({ ...valid, reps: 8.5 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, setNumber: 1.5 }).success).toBe(false);
  });
});
