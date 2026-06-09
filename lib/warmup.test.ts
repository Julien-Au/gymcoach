import { describe, it, expect } from 'vitest';
import { computeWarmupRamp } from './warmup';

describe('computeWarmupRamp', () => {
  it('builds an ascending ramp for a typical kg working weight', () => {
    // 100 kg working weight, 20 kg bar. Stages: 40/60/80% -> 40/60/80 kg,
    // all clean 2.5 kg multiples; an empty-bar set leads them off.
    const ramp = computeWarmupRamp(100, 'KG', 20);

    expect(ramp.workingWeight).toBe(100);
    expect(ramp.barWeight).toBe(20);
    expect(ramp.sets.map((s) => s.weight)).toEqual([20, 40, 60, 80]);
    // Reps descend after the empty-bar primer.
    expect(ramp.sets.map((s) => s.reps)).toEqual([8, 5, 3, 2]);
    // Every warm-up stays strictly below the working weight.
    for (const set of ramp.sets) {
      expect(set.weight).toBeLessThan(100);
    }
  });

  it('rounds warm-up weights down to a loadable increment (kg)', () => {
    // 102.5 kg -> 40% = 41 -> 40, 60% = 61.5 -> 60, 80% = 82 -> 80.
    const ramp = computeWarmupRamp(102.5, 'KG', 20);
    expect(ramp.sets.map((s) => s.weight)).toEqual([20, 40, 60, 80]);
    // Each percentage weight is a multiple of the 2.5 kg increment.
    for (const set of ramp.sets) {
      expect((set.weight * 10) % 25).toBe(0);
    }
  });

  it('rounds to a 5 lb increment for the lb display unit', () => {
    // 225 lb working weight, 45 lb bar. 40% = 90, 60% = 135, 80% = 180 - all
    // clean 5 lb multiples.
    const ramp = computeWarmupRamp(225, 'LB', 45);
    expect(ramp.sets.map((s) => s.weight)).toEqual([45, 90, 135, 180]);
    for (const set of ramp.sets) {
      expect(set.weight % 5).toBe(0);
    }
  });

  it('rounds an awkward lb working weight down to 5 lb steps', () => {
    // 187 lb -> 40% = 74.8 -> 70, 60% = 112.2 -> 110, 80% = 149.6 -> 145.
    const ramp = computeWarmupRamp(187, 'LB', 45);
    expect(ramp.sets.map((s) => s.weight)).toEqual([45, 70, 110, 145]);
    for (const set of ramp.sets) {
      expect(set.weight % 5).toBe(0);
      expect(set.weight).toBeLessThan(187);
    }
  });

  it('reports the percentage of the working weight for each stage', () => {
    const ramp = computeWarmupRamp(100, 'KG', 20);
    // Empty bar is 20% of 100; then the standard 40/60/80.
    expect(ramp.sets.map((s) => s.percent)).toEqual([20, 40, 60, 80]);
  });

  it('returns an empty ramp for a zero working weight', () => {
    expect(computeWarmupRamp(0, 'KG', 20).sets).toEqual([]);
  });

  it('returns an empty ramp for a negative working weight', () => {
    expect(computeWarmupRamp(-50, 'KG', 20).sets).toEqual([]);
  });

  it('returns an empty ramp for a non-finite working weight', () => {
    expect(computeWarmupRamp(NaN, 'KG', 20).sets).toEqual([]);
    expect(computeWarmupRamp(Infinity, 'KG', 20).sets).toEqual([]);
  });

  it('returns an empty ramp when the working weight is at or below the bar', () => {
    // Nothing to warm up to: the bar already is the load.
    expect(computeWarmupRamp(20, 'KG', 20).sets).toEqual([]);
    expect(computeWarmupRamp(15, 'KG', 20).sets).toEqual([]);
  });

  it('handles a light working weight just above the bar without duplicates', () => {
    // 25 kg working weight, 20 kg bar. The bar is not below 40% (=10), so no
    // empty-bar primer; the percentage stages all round down toward the bar
    // and de-duplicate rather than repeating the same weight.
    const ramp = computeWarmupRamp(25, 'KG', 20);
    const weights = ramp.sets.map((s) => s.weight);
    // No duplicate weights.
    expect(new Set(weights).size).toBe(weights.length);
    // All warm-ups stay below the working weight and at/above the bar.
    for (const set of ramp.sets) {
      expect(set.weight).toBeLessThan(25);
      expect(set.weight).toBeGreaterThanOrEqual(20);
    }
  });

  it('treats a zero bar weight (e.g. dumbbell/machine) as no empty-bar primer', () => {
    const ramp = computeWarmupRamp(100, 'KG', 0);
    // No empty-bar (0 kg) set; the ramp is the percentage stages only.
    expect(ramp.sets.map((s) => s.weight)).toEqual([40, 60, 80]);
    expect(ramp.sets.map((s) => s.reps)).toEqual([5, 3, 2]);
  });

  it('returns an empty ramp for a negative bar weight', () => {
    expect(computeWarmupRamp(100, 'KG', -5).sets).toEqual([]);
  });
});
