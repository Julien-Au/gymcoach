import type { Set } from '@prisma/client';
import { estimate1RM, best1RM } from '@/lib/stats';

// ============================================================
// Personal records (PRs) - derived on read from existing set
// history. There is no records table and no migration: a PR is
// computed by comparing a candidate working set against the
// lifter's prior non-warmup sets for the same exercise.
//
// Two PR types are detected:
//  - 'weight': the candidate moves a heavier load than ever before.
//  - 'e1rm':   the candidate's estimated 1RM (Epley) beats the best
//              estimated 1RM in prior history (catches higher-rep
//              sets that imply more strength without more load).
//
// Warm-up sets are excluded from both the candidate and the history
// baseline, consistent with `best1RM` / `setVolume` in lib/stats.
// All comparisons are strict, so a tie with the prior best is never
// flagged as a PR.
// ============================================================

export type PRType = 'weight' | 'e1rm';

type SetLike = Pick<Set, 'weight' | 'reps' | 'isWarmup'> & {
  // Cardio marker (issue #133): a set with a duration is conditioning work
  // and can never set a lifting PR (it also stores weight = 0, so the load
  // guard below would already exclude it - the explicit check documents it).
  durationSec?: number | null;
};

// Heaviest non-warmup load in a list of sets (0 if none).
function maxWorkingWeight(sets: SetLike[]): number {
  let max = 0;
  for (const s of sets) {
    if (s.isWarmup) continue;
    if (s.weight > max) max = s.weight;
  }
  return max;
}

// Returns the PR types a candidate set achieves versus the prior
// history for the same exercise. The candidate is ignored if it is a
// warm-up (or has a non-positive load) - it can never set a PR. With
// no prior working history, the first valid working set sets both PRs.
export function detectPRs(candidate: SetLike, history: SetLike[]): PRType[] {
  if (
    candidate.isWarmup ||
    candidate.durationSec != null ||
    candidate.weight <= 0 ||
    candidate.reps <= 0
  ) {
    return [];
  }

  const prs: PRType[] = [];

  if (candidate.weight > maxWorkingWeight(history)) {
    prs.push('weight');
  }

  if (estimate1RM(candidate.weight, candidate.reps) > best1RM(history)) {
    prs.push('e1rm');
  }

  return prs;
}

// Convenience predicate: does the candidate set any PR at all?
export function isPR(candidate: SetLike, history: SetLike[]): boolean {
  return detectPRs(candidate, history).length > 0;
}
