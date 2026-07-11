import type { Exercise, ProgramExercise, SetAutoregulationMode } from '@/lib/prisma-client';
import { weightIncrement } from '@/lib/progression';
import { constrainGymWeight, type GymLoadConstraints } from '@/lib/gym-loads';

export const MIN_FATIGUE_RATE = 0.25;
export const MAX_FATIGUE_RATE = 2;
export const MIN_LOAD_ADJUSTMENT_PCT = 1;
export const MAX_LOAD_ADJUSTMENT_PCT = 5;

export interface IntraSetConfig {
  mode: SetAutoregulationMode;
  // Expected loss of repetition capacity before the next set when the
  // prescribed rest is completed. One capacity rep means reps + RIR drops by 1.
  fatigueRate: number;
  // Percent load change used for each repetition of predicted capacity gap.
  loadAdjustmentPct: number;
}

export interface IntraSetCompletedSet {
  weight: number;
  reps: number;
  rir: number | null;
  isWarmup?: boolean;
  isDropSet?: boolean;
  createdAt?: number;
}

export type IntraSetRecommendationReason =
  | 'hold-load'
  | 'adjust-reps'
  | 'reduce-load'
  | 'increase-load'
  | 'bodyweight-adjust-reps';

export interface IntraSetRecommendation {
  mode: SetAutoregulationMode;
  weight: number;
  reps: number;
  rir: number;
  reason: IntraSetRecommendationReason;
  predictedRepsAtSameLoad: number;
  fatigueLoss: number;
  confidence: 'low' | 'medium' | 'high';
}

interface RecommendationInput {
  programExercise: ProgramExercise & { exercise: Exercise };
  completedSets: IntraSetCompletedSet[];
  // Time from the previous set of this exercise until the planned/actual next
  // attempt. It naturally includes another exercise when running a superset.
  recoverySec?: number | null;
  // Additional local-fatigue penalty when the intervening superset exercise
  // has the same primary muscle group.
  sameMuscleSuperset?: boolean;
  // Readiness/deload logic may forbid an intra-session increase while still
  // allowing a hold or reduction.
  allowLoadIncrease?: boolean;
  loadConstraints?: GymLoadConstraints | null;
}

export function defaultIntraSetConfig(
  exercise: Pick<Exercise, 'category' | 'muscleGroup' | 'usesBodyweight'>,
): Omit<IntraSetConfig, 'mode'> {
  if (exercise.category === 'CARDIO') {
    return { fatigueRate: MIN_FATIGUE_RATE, loadAdjustmentPct: 2.5 };
  }

  if (exercise.category === 'ISOLATION') {
    return { fatigueRate: 0.5, loadAdjustmentPct: 3 };
  }

  const lowerBodyCompound =
    exercise.muscleGroup === 'QUADS' ||
    exercise.muscleGroup === 'HAMSTRINGS' ||
    exercise.muscleGroup === 'GLUTES' ||
    exercise.muscleGroup === 'LOWER_BACK';

  return {
    fatigueRate: lowerBodyCompound ? 1 : 0.75,
    loadAdjustmentPct: 2.5,
  };
}

export function resolveIntraSetConfig(
  programExercise: Pick<
    ProgramExercise,
    'autoregulationMode' | 'fatigueRate' | 'loadAdjustmentPct'
  > & {
    exercise: Pick<Exercise, 'category' | 'muscleGroup' | 'usesBodyweight'>;
  },
): IntraSetConfig {
  const defaults = defaultIntraSetConfig(programExercise.exercise);
  return {
    mode: programExercise.autoregulationMode,
    fatigueRate: clamp(
      programExercise.fatigueRate ?? defaults.fatigueRate,
      MIN_FATIGUE_RATE,
      MAX_FATIGUE_RATE,
    ),
    loadAdjustmentPct: clamp(
      programExercise.loadAdjustmentPct ?? defaults.loadAdjustmentPct,
      MIN_LOAD_ADJUSTMENT_PCT,
      MAX_LOAD_ADJUSTMENT_PCT,
    ),
  };
}

export function recommendNextIntraSet({
  programExercise,
  completedSets,
  recoverySec,
  sameMuscleSuperset = false,
  allowLoadIncrease = true,
  loadConstraints,
}: RecommendationInput): IntraSetRecommendation | null {
  if (programExercise.exercise.category === 'CARDIO') return null;

  const workingSets = completedSets.filter((set) => !set.isWarmup && !set.isDropSet);
  const lastSet = workingSets.at(-1);
  if (!lastSet) return null;

  const config = resolveIntraSetConfig(programExercise);
  const actualRir = lastSet.rir ?? programExercise.targetRIR;
  const lastCapacity = lastSet.reps + actualRir;
  const restModifier = recoveryModifier(programExercise.restSec, recoverySec);
  const supersetModifier = sameMuscleSuperset ? 1.25 : 1;
  const fatigueLoss = round(config.fatigueRate * restModifier * supersetModifier, 2);
  const nextCapacity = Math.max(0, lastCapacity - fatigueLoss);
  const predictedRepsAtSameLoad = Math.max(0, Math.round(nextCapacity - programExercise.targetRIR));

  const desiredReps =
    config.mode === 'PRESERVE_REPS'
      ? clamp(lastSet.reps, programExercise.targetRepsMin, programExercise.targetRepsMax)
      : clamp(
          predictedRepsAtSameLoad,
          programExercise.targetRepsMin,
          programExercise.targetRepsMax,
        );

  let capacityGap = 0;
  if (config.mode === 'PRESERVE_REPS') {
    capacityGap = desiredReps - predictedRepsAtSameLoad;
  } else if (predictedRepsAtSameLoad < programExercise.targetRepsMin) {
    capacityGap = programExercise.targetRepsMin - predictedRepsAtSameLoad;
  } else if (predictedRepsAtSameLoad > programExercise.targetRepsMax) {
    capacityGap = programExercise.targetRepsMax - predictedRepsAtSameLoad;
  }

  if (!allowLoadIncrease && capacityGap < 0) capacityGap = 0;

  const adjustmentPct = clamp(capacityGap * config.loadAdjustmentPct, -5, 10);
  const increment = weightIncrement(programExercise.exercise.category);
  const calculatedWeight = adjustWeight(lastSet.weight, adjustmentPct, increment);
  const adjustedWeight = constrainGymWeight(calculatedWeight, lastSet.weight, loadConstraints);

  let reason: IntraSetRecommendationReason;
  if (lastSet.weight === 0 && capacityGap > 0) {
    reason = 'bodyweight-adjust-reps';
  } else if (adjustedWeight < lastSet.weight) {
    reason = 'reduce-load';
  } else if (adjustedWeight > lastSet.weight) {
    reason = 'increase-load';
  } else if (predictedRepsAtSameLoad !== lastSet.reps) {
    reason = 'adjust-reps';
  } else {
    reason = 'hold-load';
  }

  return {
    mode: config.mode,
    weight: adjustedWeight,
    reps: reason === 'bodyweight-adjust-reps' ? Math.max(1, predictedRepsAtSameLoad) : desiredReps,
    rir: programExercise.targetRIR,
    reason,
    predictedRepsAtSameLoad,
    fatigueLoss,
    confidence: lastSet.rir == null ? 'low' : workingSets.length >= 3 ? 'high' : 'medium',
  };
}

function recoveryModifier(plannedRestSec: number, recoverySec?: number | null): number {
  if (recoverySec == null || recoverySec <= 0) return 1;
  return clamp(plannedRestSec / recoverySec, 0.75, 1.5);
}

function adjustWeight(weight: number, adjustmentPct: number, increment: number): number {
  if (adjustmentPct === 0 || weight <= 0) return weight;

  const raw = Math.max(0, weight * (1 - adjustmentPct / 100));
  let rounded = Math.round(raw / increment) * increment;

  if (adjustmentPct > 0 && rounded >= weight) rounded = Math.max(0, weight - increment);
  if (adjustmentPct < 0 && rounded <= weight) rounded = weight + increment;
  return round(rounded, 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
