import type { Exercise, ProgramExercise, Set } from '@prisma/client';

// ============================================================
// Load suggestion - double progression
// ============================================================
// Rule: if every working set of the last session reached the top of the
// target rep range, we increase the load (+2.5 kg compound, +1 kg isolation).
// Otherwise we keep the load and beat the reps.

export type SuggestionReason = 'no-history' | 'same-as-last' | 'progression';

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

export function suggestNextWeight(
  programExercise: ProgramExercise & { exercise: Exercise },
  lastSets: Pick<Set, 'weight' | 'reps' | 'rir'>[],
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

  if (allHitTopRange) {
    const delta = weightIncrement(programExercise.exercise.category);
    return {
      weight: +(workingWeight + delta).toFixed(2),
      reason: 'progression',
      workingWeight,
      delta,
      targetRepsMax,
    };
  }

  return {
    weight: workingWeight,
    reason: 'same-as-last',
    workingWeight,
    targetRepsMax,
  };
}

// Standard increment for the +/- buttons depending on the exercise category.
// Compound: 2.5 kg, isolation: 1 kg.
export function weightIncrement(category: Exercise['category']): number {
  return category === 'COMPOUND' ? 2.5 : 1;
}
