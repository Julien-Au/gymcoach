import { z } from 'zod';
import { MuscleGroup, ExerciseCategory } from '@prisma/client';

export const muscleGroupValues = Object.values(MuscleGroup) as [MuscleGroup, ...MuscleGroup[]];
export const exerciseCategoryValues = Object.values(ExerciseCategory) as [
  ExerciseCategory,
  ...ExerciseCategory[],
];

export const exerciseInputSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(120, 'Trop long'),
  muscleGroup: z.enum(muscleGroupValues),
  category: z.enum(exerciseCategoryValues),
  defaultRestSec: z.coerce.number().int().min(15).max(600).default(90),
  notes: z.string().trim().max(2000).optional().nullable(),
  // Pour les exos au poids du corps (tractions, dips...) : le tonnage
  // effectif inclut User.bodyweight.
  usesBodyweight: z.coerce.boolean().default(false),
});

export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  CHEST: 'Pectoraux',
  BACK_WIDTH: 'Dos (largeur)',
  BACK_THICKNESS: 'Dos (épaisseur)',
  SHOULDERS_FRONT: 'Épaules avant',
  SHOULDERS_LATERAL: 'Épaules latéral',
  SHOULDERS_REAR: 'Épaules arrière',
  BICEPS: 'Biceps',
  TRICEPS: 'Triceps',
  FOREARMS: 'Avant-bras',
  QUADS: 'Quadriceps',
  HAMSTRINGS: 'Ischios',
  GLUTES: 'Fessiers',
  CALVES: 'Mollets',
  ABS: 'Abdos',
  LOWER_BACK: 'Lombaires',
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  COMPOUND: 'Composé',
  ISOLATION: 'Isolation',
};
