import { describe, it, expect } from 'vitest';
import { setInputSchema, validateSetForCategory } from './set';

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

  it('leaves cardio fields undefined when absent (strength payloads unchanged)', () => {
    const parsed = setInputSchema.parse(valid);
    expect(parsed.durationSec).toBeUndefined();
    expect(parsed.distanceM).toBeUndefined();
  });

  it('accepts in-range duration and distance and coerces numeric strings', () => {
    const parsed = setInputSchema.parse({
      ...valid,
      durationSec: '750',
      distanceM: '2500',
    });
    expect(parsed.durationSec).toBe(750);
    expect(parsed.distanceM).toBe(2500);
  });

  it('rejects absurd duration and distance values', () => {
    expect(setInputSchema.safeParse({ ...valid, durationSec: 0 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, durationSec: 86401 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, durationSec: 12.5 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, distanceM: -1 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, distanceM: 1000001 }).success).toBe(false);
  });

  it('accepts in-range avg/max HR and coerces numeric strings', () => {
    const parsed = setInputSchema.parse({ ...valid, avgHr: '150', maxHr: '178' });
    expect(parsed.avgHr).toBe(150);
    expect(parsed.maxHr).toBe(178);
  });

  it('rejects out-of-range or non-integer max HR (issue #203)', () => {
    expect(setInputSchema.safeParse({ ...valid, maxHr: 39 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, maxHr: 251 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, maxHr: 150.5 }).success).toBe(false);
  });
});

describe('validateSetForCategory', () => {
  it('accepts a strength set without cardio fields on any strength category', () => {
    expect(validateSetForCategory('COMPOUND', {})).toBeNull();
    expect(validateSetForCategory('ISOLATION', { durationSec: null, distanceM: null })).toBeNull();
  });

  it('rejects duration or distance on non-cardio exercises', () => {
    expect(validateSetForCategory('COMPOUND', { durationSec: 600 })).toMatch(/cardio/i);
    expect(validateSetForCategory('ISOLATION', { distanceM: 1000 })).toMatch(/cardio/i);
  });

  it('rejects a max HR on non-cardio exercises (issue #203)', () => {
    expect(validateSetForCategory('COMPOUND', { maxHr: 170 })).toMatch(/cardio/i);
  });

  it('requires a duration on cardio exercises', () => {
    expect(validateSetForCategory('CARDIO', {})).toMatch(/duration/i);
    expect(validateSetForCategory('CARDIO', { distanceM: 1000 })).toMatch(/duration/i);
  });

  it('accepts a cardio set with a duration (distance optional)', () => {
    expect(validateSetForCategory('CARDIO', { durationSec: 750 })).toBeNull();
    expect(validateSetForCategory('CARDIO', { durationSec: 750, distanceM: 2500 })).toBeNull();
  });
});
