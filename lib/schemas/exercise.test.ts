import { describe, it, expect } from 'vitest';
import { exerciseInputSchema } from './exercise';

describe('exerciseInputSchema', () => {
  const valid = { name: 'Bench press', muscleGroup: 'CHEST', category: 'COMPOUND' };

  it('accepts a valid exercise and applies defaults', () => {
    const parsed = exerciseInputSchema.parse(valid);
    expect(parsed.defaultRestSec).toBe(90);
    expect(parsed.usesBodyweight).toBe(false);
  });

  it('trims the name and rejects an empty one', () => {
    expect(exerciseInputSchema.parse({ ...valid, name: '  Squat  ' }).name).toBe('Squat');
    expect(exerciseInputSchema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
  });

  it('rejects an unknown muscle group or category', () => {
    expect(exerciseInputSchema.safeParse({ ...valid, muscleGroup: 'NECK' }).success).toBe(false);
    expect(exerciseInputSchema.safeParse({ ...valid, category: 'CARDIO' }).success).toBe(false);
  });

  it('coerces usesBodyweight and enforces the rest-time range', () => {
    expect(exerciseInputSchema.parse({ ...valid, usesBodyweight: 'true' }).usesBodyweight).toBe(
      true,
    );
    expect(exerciseInputSchema.safeParse({ ...valid, defaultRestSec: 5 }).success).toBe(false);
    expect(exerciseInputSchema.safeParse({ ...valid, defaultRestSec: 601 }).success).toBe(false);
  });
});
