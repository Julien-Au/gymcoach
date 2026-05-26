import type { Exercise, ProgramExercise, Set } from '@prisma/client';

// ============================================================
// Suggestion de charge - double progression
// ============================================================
// Règle : si toutes les séries de travail de la dernière séance ont atteint le
// haut de la fourchette de reps cible, on monte la charge (+2.5 kg composé,
// +1 kg isolation). Sinon on garde la charge et on bat les reps.

export type SuggestionReason = 'no-history' | 'same-as-last' | 'progression';

export interface SuggestionResult {
  weight: number | null;
  reason: SuggestionReason;
  // Charge de référence prise dans la dernière séance (max weight non-warmup).
  workingWeight?: number;
  // Incrément appliqué quand on progresse (kg).
  delta?: number;
  // Haut de la fourchette de reps utilisé comme seuil de progression.
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

  // On ne considère que les séries effectuées à la charge de travail. Les drop
  // sets éventuels (charges plus légères) sont ignorés pour décider de la
  // progression.
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

// Incrément standard pour les boutons +/- selon la catégorie d'exercice.
// Composés : 2.5 kg, isolation : 1 kg.
export function weightIncrement(category: Exercise['category']): number {
  return category === 'COMPOUND' ? 2.5 : 1;
}
