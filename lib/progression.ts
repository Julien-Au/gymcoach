import type { Exercise, MuscleGroup, ProgramExercise, Set } from '@prisma/client';

// ============================================================
// Load suggestion - double progression
// ============================================================
// Rule: if every working set of the last session reached the top of the
// target rep range, we increase the load (+2.5 kg compound, +1 kg isolation).
// Otherwise we keep the load and beat the reps.
//
// Auto-regulation (issue #53): a recent readiness/soreness check-in can make
// the suggestion more conservative - it may HOLD the load (skip the increment)
// or apply a single step-down when recovery is very poor. It can NEVER raise the
// load beyond the normal progression rule (safety; avoids gaming the check-in).
// With no readiness data in the recency window the output is identical to the
// rule above.

export type SuggestionReason =
  | 'no-history'
  | 'same-as-last'
  | 'progression'
  | 'readiness-hold'
  | 'readiness-deload';

export interface SuggestionResult {
  weight: number | null;
  reason: SuggestionReason;
  // Reference load taken from the last session (max non-warmup weight).
  workingWeight?: number;
  // Increment applied when progressing (kg).
  delta?: number;
  // Top of the rep range used as the progression threshold.
  targetRepsMax?: number;
}

// ------------------------------------------------------------
// Readiness thresholds (named constants with rationale)
// ------------------------------------------------------------
// Recency window: a check-in only auto-regulates today's suggestion if it is
// fresh. 36h covers "logged last night or this morning" without letting a stale
// reading from days ago silently hold the load.
export const READINESS_RECENCY_HOURS = 36;
// Overall readiness is rated 1 (drained) to 5 (primed). At or below this we hold
// the load instead of adding weight.
export const READINESS_HOLD_AT_OR_BELOW = 2;
// The lowest readiness rating - "drained". Treated as very poor recovery and
// triggers a conservative step-down rather than just a hold.
export const READINESS_DELOAD_AT_OR_BELOW = 1;
// Per-muscle soreness is rated 1 (none) to 5 (severe). At or above this for the
// exercise's primary muscle group we hold the load.
export const SORENESS_HOLD_AT_OR_ABOVE = 4;
// Severe soreness ("can barely move it") - triggers a step-down.
export const SORENESS_DELOAD_AT_OR_ABOVE = 5;
// Conservative single step-down, expressed as a fraction of the working load.
// 10% is a light, evidence-informed deload that protects a fatigued muscle
// without throwing away the training block.
export const READINESS_DELOAD_FRACTION = 0.1;

// A recent readiness check-in, shaped for pure progression logic. The caller
// resolves recency by passing `ageHours` (how old the check-in is), keeping this
// module free of clock access and fully deterministic.
export interface ReadinessSignal {
  // Overall readiness to train, 1 (drained) to 5 (primed).
  readiness: number;
  // Optional per-muscle-group soreness, group -> 1 (none) to 5 (severe).
  soreness?: Partial<Record<MuscleGroup, number>> | null;
  // How old the check-in is, in hours. Used against READINESS_RECENCY_HOURS.
  ageHours: number;
}

// Applies the user's auto-regulation preference (issue #61) to a readiness
// signal before it reaches suggestNextWeight. When the preference is off, the
// signal is dropped (returns null), so the suggestion follows pure programmed
// progression - identical to the pre-#55 behavior. When on, the signal passes
// through unchanged. Kept pure so the gate is unit-testable on its own.
export function readinessForSuggestion(
  readiness: ReadinessSignal | null,
  autoRegulationEnabled: boolean,
): ReadinessSignal | null {
  return autoRegulationEnabled ? readiness : null;
}

export function suggestNextWeight(
  programExercise: ProgramExercise & { exercise: Exercise },
  lastSets: Pick<Set, 'weight' | 'reps' | 'rir'>[],
  readiness?: ReadinessSignal | null,
): SuggestionResult {
  if (lastSets.length === 0) {
    return { weight: null, reason: 'no-history' };
  }

  const targetRepsMax = programExercise.targetRepsMax;
  const workingWeight = Math.max(...lastSets.map((s) => s.weight));

  // We only consider the sets performed at the working load. Any drop sets
  // (lighter loads) are ignored when deciding on progression.
  const workingSets = lastSets.filter((s) => s.weight === workingWeight);
  const allHitTopRange = workingSets.every((s) => s.reps >= targetRepsMax);

  // Baseline (readiness-unaware) suggestion - identical to the original rule.
  const delta = weightIncrement(programExercise.exercise.category);
  const baseline: SuggestionResult = allHitTopRange
    ? {
        weight: +(workingWeight + delta).toFixed(2),
        reason: 'progression',
        workingWeight,
        delta,
        targetRepsMax,
      }
    : {
        weight: workingWeight,
        reason: 'same-as-last',
        workingWeight,
        targetRepsMax,
      };

  const recovery = assessRecovery(readiness, programExercise.exercise.muscleGroup);
  if (recovery === 'ok') {
    return baseline;
  }

  // Readiness may only hold or reduce. A step-down goes below the working load;
  // a hold keeps the working load (never above it).
  if (recovery === 'deload') {
    const reduced = +(workingWeight * (1 - READINESS_DELOAD_FRACTION)).toFixed(2);
    return {
      weight: reduced,
      reason: 'readiness-deload',
      workingWeight,
      targetRepsMax,
    };
  }

  // hold: keep the working load, drop any progression increment.
  return {
    weight: workingWeight,
    reason: 'readiness-hold',
    workingWeight,
    targetRepsMax,
  };
}

type Recovery = 'ok' | 'hold' | 'deload';

// Decides whether a recent check-in should make the suggestion more
// conservative. Returns 'ok' (no change) when there is no usable, in-window
// signal, so the no-data path is byte-for-byte identical to the base rule.
function assessRecovery(
  readiness: ReadinessSignal | null | undefined,
  muscleGroup: MuscleGroup,
): Recovery {
  if (!readiness) return 'ok';
  // Out-of-window check-ins are ignored (stale signal must not hold the load).
  if (!(readiness.ageHours <= READINESS_RECENCY_HOURS)) return 'ok';

  const groupSoreness = readiness.soreness?.[muscleGroup];

  const veryPoor =
    readiness.readiness <= READINESS_DELOAD_AT_OR_BELOW ||
    (typeof groupSoreness === 'number' && groupSoreness >= SORENESS_DELOAD_AT_OR_ABOVE);
  if (veryPoor) return 'deload';

  const poor =
    readiness.readiness <= READINESS_HOLD_AT_OR_BELOW ||
    (typeof groupSoreness === 'number' && groupSoreness >= SORENESS_HOLD_AT_OR_ABOVE);
  if (poor) return 'hold';

  return 'ok';
}

// Standard increment for the +/- buttons depending on the exercise category.
// Compound: 2.5 kg, isolation: 1 kg.
export function weightIncrement(category: Exercise['category']): number {
  return category === 'COMPOUND' ? 2.5 : 1;
}
