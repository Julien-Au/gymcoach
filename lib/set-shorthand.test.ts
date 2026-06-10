import { describe, it, expect } from 'vitest';
import { parseSetShorthand, rpeToRir } from './set-shorthand';

describe('parseSetShorthand', () => {
  it('parses the compact "weight x reps" form', () => {
    expect(parseSetShorthand('100x8')).toEqual({ weight: 100, reps: 8 });
  });

  it('parses the spaced "weight x reps" form', () => {
    expect(parseSetShorthand('100 x 8')).toEqual({ weight: 100, reps: 8 });
  });

  it('is case-insensitive on the x separator', () => {
    expect(parseSetShorthand('100X8')).toEqual({ weight: 100, reps: 8 });
  });

  it('parses the space-separated "weight reps" form', () => {
    expect(parseSetShorthand('100 8')).toEqual({ weight: 100, reps: 8 });
  });

  it('parses an RPE after @', () => {
    expect(parseSetShorthand('100x8@9')).toEqual({ weight: 100, reps: 8, rpe: 9 });
  });

  it('parses a spaced RPE after @', () => {
    expect(parseSetShorthand('100 x 8 @ 9')).toEqual({ weight: 100, reps: 8, rpe: 9 });
  });

  it('parses the fully space-separated "weight reps rpe" form', () => {
    expect(parseSetShorthand('100 8 9')).toEqual({ weight: 100, reps: 8, rpe: 9 });
  });

  it('parses a decimal weight', () => {
    expect(parseSetShorthand('62.5x8')).toEqual({ weight: 62.5, reps: 8 });
  });

  it('parses a decimal RPE', () => {
    expect(parseSetShorthand('100x8@8.5')).toEqual({ weight: 100, reps: 8, rpe: 8.5 });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseSetShorthand('  100x8  ')).toEqual({ weight: 100, reps: 8 });
  });

  it('rejects an RPE above 10', () => {
    expect(parseSetShorthand('100x8@11')).toBeNull();
    expect(parseSetShorthand('100x8@10.5')).toBeNull();
  });

  it('rejects an RPE below 1', () => {
    expect(parseSetShorthand('100x8@0')).toBeNull();
    expect(parseSetShorthand('100x8@0.5')).toBeNull();
  });

  it('accepts the RPE bounds 1 and 10', () => {
    expect(parseSetShorthand('100x8@1')).toEqual({ weight: 100, reps: 8, rpe: 1 });
    expect(parseSetShorthand('100x8@10')).toEqual({ weight: 100, reps: 8, rpe: 10 });
  });

  it('rejects zero reps', () => {
    expect(parseSetShorthand('100x0')).toBeNull();
  });

  it('rejects decimal reps', () => {
    expect(parseSetShorthand('100x8.5')).toBeNull();
  });

  it('does not misread a decimal as an RPE when the separator is missing', () => {
    // Without a required separator this would backtrack into reps=8, rpe=9.5.
    expect(parseSetShorthand('100 89.5')).toBeNull();
  });

  it('rejects empty and whitespace-only input', () => {
    expect(parseSetShorthand('')).toBeNull();
    expect(parseSetShorthand('   ')).toBeNull();
  });

  it('rejects plain words and partial entries', () => {
    expect(parseSetShorthand('squat')).toBeNull();
    expect(parseSetShorthand('100')).toBeNull();
    expect(parseSetShorthand('100x')).toBeNull();
    expect(parseSetShorthand('x8')).toBeNull();
    expect(parseSetShorthand('100x8@')).toBeNull();
  });

  it('rejects negative numbers and trailing junk', () => {
    expect(parseSetShorthand('-100x8')).toBeNull();
    expect(parseSetShorthand('100x8 extra')).toBeNull();
  });

  it('rejects out-of-scope shorthands (bodyweight, multi-set)', () => {
    expect(parseSetShorthand('bw x 10')).toBeNull();
    expect(parseSetShorthand('3x8x100')).toBeNull();
  });
});

describe('rpeToRir', () => {
  it('maps RPE to RIR as 10 - RPE', () => {
    expect(rpeToRir(10)).toBe(0);
    expect(rpeToRir(9)).toBe(1);
    expect(rpeToRir(7)).toBe(3);
  });

  it('rounds half-point RPEs to the nearest integer RIR', () => {
    expect(rpeToRir(8.5)).toBe(2);
    expect(rpeToRir(9.5)).toBe(1);
  });

  it('clamps to the API range 0-5', () => {
    expect(rpeToRir(1)).toBe(5);
    expect(rpeToRir(4)).toBe(5);
  });
});
