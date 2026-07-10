import type { ExerciseCategory, MuscleGroup } from '@/lib/prisma-client';

export const muscleGroupMessageKeys = {
  CHEST: 'chest',
  BACK_WIDTH: 'backWidth',
  BACK_THICKNESS: 'backThickness',
  SHOULDERS_FRONT: 'shouldersFront',
  SHOULDERS_LATERAL: 'shouldersLateral',
  SHOULDERS_REAR: 'shouldersRear',
  BICEPS: 'biceps',
  TRICEPS: 'triceps',
  FOREARMS: 'forearms',
  QUADS: 'quads',
  HAMSTRINGS: 'hamstrings',
  GLUTES: 'glutes',
  CALVES: 'calves',
  ABS: 'abs',
  LOWER_BACK: 'lowerBack',
  OTHER: 'other',
} as const satisfies Record<MuscleGroup, string>;

export const exerciseCategoryMessageKeys = {
  COMPOUND: 'compound',
  ISOLATION: 'isolation',
  CARDIO: 'cardio',
} as const satisfies Record<ExerciseCategory, string>;
