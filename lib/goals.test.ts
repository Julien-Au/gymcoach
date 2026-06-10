import { describe, it, expect } from 'vitest';
import {
  findAchievingSet,
  goalProgress,
  goalTargetE1RM,
  setAchievesGoal,
} from './goals';
import { applyBodyweight, best1RM, effectiveWeight } from './stats';

const target = { targetWeight: 100, targetReps: 5 };

function set(over: Partial<{ weight: number; reps: number; isWarmup: boolean; completedAt: Date }>) {
  return {
    weight: 80,
    reps: 8,
    isWarmup: false,
    completedAt: new Date('2026-06-01T10:00:00Z'),
    ...over,
  };
}

describe('goalTargetE1RM', () => {
  it('uses the Epley formula like the rest of the app', () => {
    // 100 x 5 -> 100 * (1 + 5/30)
    expect(goalTargetE1RM(target)).toBeCloseTo(116.67, 1);
  });
});

describe('goalProgress', () => {
  it('returns 0 with no sets yet (bestE1RM = 0)', () => {
    expect(goalProgress(0, target)).toBe(0);
    expect(goalProgress(best1RM([]), target)).toBe(0);
  });

  it('returns the e1RM fraction toward the goal', () => {
    // Best so far: 90x5 -> 105 e1RM; target 100x5 -> 116.67.
    const best = best1RM([set({ weight: 90, reps: 5 })]);
    expect(goalProgress(best, target)).toBeCloseTo(105 / (100 * (1 + 5 / 30)), 5);
  });

  it('clamps at 1 when the target is already beaten', () => {
    const best = best1RM([set({ weight: 120, reps: 8 })]);
    expect(goalProgress(best, target)).toBe(1);
  });

  it('returns 0 on a degenerate target', () => {
    expect(goalProgress(100, { targetWeight: 0, targetReps: 5 })).toBe(0);
  });
});

describe('setAchievesGoal', () => {
  it('requires both axes to meet the target', () => {
    expect(setAchievesGoal(set({ weight: 100, reps: 5 }), target)).toBe(true);
    expect(setAchievesGoal(set({ weight: 102.5, reps: 6 }), target)).toBe(true);
    expect(setAchievesGoal(set({ weight: 100, reps: 4 }), target)).toBe(false);
    expect(setAchievesGoal(set({ weight: 97.5, reps: 12 }), target)).toBe(false);
  });

  it('ignores warmup sets', () => {
    expect(setAchievesGoal(set({ weight: 100, reps: 5, isWarmup: true }), target)).toBe(false);
  });
});

describe('findAchievingSet', () => {
  it('returns null when nothing meets the target', () => {
    expect(findAchievingSet([set({ weight: 95, reps: 5 })], target)).toBeNull();
  });

  it('finds a past set that already beat the target at goal-creation time', () => {
    const old = set({ weight: 105, reps: 5, completedAt: new Date('2026-05-01T10:00:00Z') });
    const recent = set({ weight: 110, reps: 5, completedAt: new Date('2026-06-01T10:00:00Z') });
    expect(findAchievingSet([recent, old], target)).toBe(old);
  });

  it('is deterministic: picks the earliest achieving set regardless of order', () => {
    const a = set({ weight: 100, reps: 5, completedAt: new Date('2026-05-02T10:00:00Z') });
    const b = set({ weight: 100, reps: 6, completedAt: new Date('2026-05-01T10:00:00Z') });
    expect(findAchievingSet([a, b], target)).toBe(b);
    expect(findAchievingSet([b, a], target)).toBe(b);
  });
});

describe('bodyweight exercises (effectiveWeight semantics, like lib/stats)', () => {
  // Weighted pull-ups: bodyweight 80 kg, target = 100 kg effective x 5
  // (i.e. +20 kg added). Set.weight stores only the added load.
  const bodyweight = 80;

  it('achieves through the effective load, not the raw added load', () => {
    const raw = { weight: 20, reps: 5, isWarmup: false };
    // Raw added load (20) never reaches 100 ...
    expect(setAchievesGoal(raw, target)).toBe(false);
    // ... but the effective load (80 + 20) does.
    const adjusted = {
      ...raw,
      weight: effectiveWeight(raw.weight, true, bodyweight),
    };
    expect(setAchievesGoal(adjusted, target)).toBe(true);
  });

  it('progress uses the bodyweight-adjusted best e1RM, like the progress page', () => {
    const sets = applyBodyweight(
      [{ weight: 10, reps: 5, isWarmup: false, usesBodyweight: true }],
      bodyweight,
    );
    // Effective 90x5 -> 105 e1RM vs target 116.67.
    expect(goalProgress(best1RM(sets), target)).toBeCloseTo(105 / (100 * (1 + 5 / 30)), 5);
  });
});
