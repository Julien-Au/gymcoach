import type { Set } from '@/lib/prisma-client';
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

// ============================================================
// Records board (issue #190) - all-time bests per exercise
// ============================================================
// A pure derivation over a user's working-set history: for each strength
// exercise, the heaviest working set ever (weight x reps and its date) and the
// best estimated 1RM ever (Epley, with its date). Display-only - there is no
// records table. Cardio sets and warm-ups carry no lifting record and are
// excluded, consistent with `best1RM` / `setVolume` in lib/stats and the PR
// detector above.
//
// Bodyweight exercises: the caller passes the effective load (entered weight +
// bodyweight) in `weight`, the same `applyBodyweight` adjustment the progress
// page uses everywhere else, so a bodyweight movement's records read on the
// load actually moved rather than the added plates alone.

// A working set decorated with its exercise name and session date. The caller
// builds these from the rows it already loads for the progress page.
type RecordSet = Pick<Set, 'weight' | 'reps' | 'isWarmup'> & {
  durationSec?: number | null;
  exerciseName: string;
  sessionStartedAt: Date;
};

// The all-time bests for one exercise.
export interface ExerciseRecord {
  exerciseName: string;
  maxWeight: number;
  maxWeightReps: number; // reps of the heaviest set
  maxWeightDate: string; // ISO date (YYYY-MM-DD) the heaviest set was logged
  bestE1RM: number; // rounded to 1 decimal, like exerciseProgress
  bestE1RMDate: string; // ISO date of the set with the best estimated 1RM
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Given a flat list of (bodyweight-adjusted) working sets across exercises,
// returns one record per strength exercise, sorted alphabetically by exercise
// name (stable and predictable for a board the user scans by lift). Warm-ups,
// cardio sets, and sets with a non-positive load or reps are ignored; an
// exercise with no qualifying set yields no row. Ties keep the earliest set
// (the date the record was first reached).
export function exerciseRecords(sets: RecordSet[]): ExerciseRecord[] {
  const byExercise = new Map<string, ExerciseRecord>();

  for (const s of sets) {
    if (s.isWarmup || s.durationSec != null || s.weight <= 0 || s.reps <= 0) {
      continue;
    }

    const e1rm = +estimate1RM(s.weight, s.reps).toFixed(1);
    const day = isoDay(s.sessionStartedAt);
    const current = byExercise.get(s.exerciseName);

    if (!current) {
      byExercise.set(s.exerciseName, {
        exerciseName: s.exerciseName,
        maxWeight: s.weight,
        maxWeightReps: s.reps,
        maxWeightDate: day,
        bestE1RM: e1rm,
        bestE1RMDate: day,
      });
      continue;
    }

    // Strictly heavier load wins the weight record; a tie keeps the earlier
    // date already stored (we only overwrite on a strict improvement).
    if (s.weight > current.maxWeight) {
      current.maxWeight = s.weight;
      current.maxWeightReps = s.reps;
      current.maxWeightDate = day;
    }
    if (e1rm > current.bestE1RM) {
      current.bestE1RM = e1rm;
      current.bestE1RMDate = day;
    }
  }

  return [...byExercise.values()].sort((a, b) =>
    a.exerciseName.localeCompare(b.exerciseName),
  );
}
