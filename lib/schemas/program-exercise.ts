import { z } from 'zod';
import { MAX_SUPERSET_GROUP, MIN_SUPERSET_GROUP } from '@/lib/supersets';

export const programExerciseInputSchema = z
  .object({
    exerciseId: z.string().min(1, 'Exercise required'),
    targetSets: z.coerce.number().int().min(1).max(20),
    targetRepsMin: z.coerce.number().int().min(1).max(50),
    targetRepsMax: z.coerce.number().int().min(1).max(50),
    targetRIR: z.coerce.number().int().min(0).max(5),
    restSec: z.coerce.number().int().min(15).max(600),
    tempo: z.string().trim().max(20).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    // Superset pairing (issue #146, slice 1): exercises of one workout sharing
    // a group number form a superset. null clears the pairing; ABSENT leaves
    // it unchanged on update (so the edit form never wipes a pairing).
    supersetGroup: z
      .number()
      .int()
      .min(MIN_SUPERSET_GROUP)
      .max(MAX_SUPERSET_GROUP)
      .nullable()
      .optional(),
  })
  .refine((v) => v.targetRepsMax >= v.targetRepsMin, {
    message: 'Reps max must be >= reps min',
    path: ['targetRepsMax'],
  });

export type ProgramExerciseInput = z.infer<typeof programExerciseInputSchema>;
