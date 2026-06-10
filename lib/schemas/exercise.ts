import { z } from 'zod';
import { MuscleGroup, ExerciseCategory } from '@prisma/client';

export const muscleGroupValues = Object.values(MuscleGroup) as [MuscleGroup, ...MuscleGroup[]];
export const exerciseCategoryValues = Object.values(ExerciseCategory) as [
  ExerciseCategory,
  ...ExerciseCategory[],
];

export const exerciseInputSchema = z.object({
  name: z.string().trim().min(1, 'Name required').max(120, 'Too long'),
  muscleGroup: z.enum(muscleGroupValues),
  category: z.enum(exerciseCategoryValues),
  defaultRestSec: z.coerce.number().int().min(15).max(600).default(90),
  notes: z.string().trim().max(2000).optional().nullable(),
  // For bodyweight exercises (pull-ups, dips...): the effective
  // tonnage includes User.bodyweight.
  usesBodyweight: z.coerce.boolean().default(false),
});

export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  CHEST: 'Chest',
  BACK_WIDTH: 'Back (width)',
  BACK_THICKNESS: 'Back (thickness)',
  SHOULDERS_FRONT: 'Front delts',
  SHOULDERS_LATERAL: 'Side delts',
  SHOULDERS_REAR: 'Rear delts',
  BICEPS: 'Biceps',
  TRICEPS: 'Triceps',
  FOREARMS: 'Forearms',
  QUADS: 'Quads',
  HAMSTRINGS: 'Hamstrings',
  GLUTES: 'Glutes',
  CALVES: 'Calves',
  ABS: 'Abs',
  LOWER_BACK: 'Lower back',
  OTHER: 'Other',
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  COMPOUND: 'Compound',
  ISOLATION: 'Isolation',
};
