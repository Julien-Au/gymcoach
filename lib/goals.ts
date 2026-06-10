import { estimate1RM } from '@/lib/stats';

// ============================================================
// Per-exercise target goals (issue #90) - pure derivations
// ============================================================
//
// A goal is a concrete "weight x reps" target. Progress is measured on the
// e1RM scale so a 5-rep target and an 8-rep PR remain comparable:
//
//   progress = min(1, best e1RM so far / estimate1RM(targetWeight, targetReps))
//
// Bodyweight semantics: every weight entering these helpers (set weights AND
// the goal target) must be on the same scale as lib/stats.ts - i.e. the
// EFFECTIVE load. Callers adjust set weights with applyBodyweight /
// effectiveWeight before calling, exactly like the progress page does.

export interface GoalTarget {
  // Target load in kg (effective load for bodyweight exercises).
  targetWeight: number;
  targetReps: number;
}

// The e1RM the target corresponds to (Epley, like the rest of the app).
export function goalTargetE1RM(target: GoalTarget): number {
  return estimate1RM(target.targetWeight, target.targetReps);
}

// Fraction of the way to the goal on the e1RM scale, clamped to [0, 1].
// Returns 0 with no training data yet (bestE1RM <= 0) or a degenerate target.
export function goalProgress(bestE1RM: number, target: GoalTarget): number {
  const targetE1RM = goalTargetE1RM(target);
  if (targetE1RM <= 0 || bestE1RM <= 0) return 0;
  return Math.min(1, bestE1RM / targetE1RM);
}

// A set is achieving when it is a working set (not a warmup) matching or
// beating the target on BOTH axes: weight >= targetWeight and
// reps >= targetReps.
export function setAchievesGoal(
  set: { weight: number; reps: number; isWarmup: boolean },
  target: GoalTarget,
): boolean {
  return !set.isWarmup && set.weight >= target.targetWeight && set.reps >= target.targetReps;
}

// Earliest set that achieves the goal, or null. Used to stamp achievedAt
// deterministically (the achieving set's completedAt, not "now"), so the
// result is the same whether the goal is checked at set-save time or when a
// goal is created over an already-beaten target.
export function findAchievingSet<
  T extends { weight: number; reps: number; isWarmup: boolean; completedAt: Date },
>(sets: T[], target: GoalTarget): T | null {
  let earliest: T | null = null;
  for (const s of sets) {
    if (!setAchievesGoal(s, target)) continue;
    if (earliest === null || s.completedAt < earliest.completedAt) earliest = s;
  }
  return earliest;
}
