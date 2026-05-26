import { z } from 'zod';

export const programExerciseInputSchema = z
  .object({
    exerciseId: z.string().min(1, 'Exercice requis'),
    targetSets: z.coerce.number().int().min(1).max(20),
    targetRepsMin: z.coerce.number().int().min(1).max(50),
    targetRepsMax: z.coerce.number().int().min(1).max(50),
    targetRIR: z.coerce.number().int().min(0).max(5),
    restSec: z.coerce.number().int().min(15).max(600),
    tempo: z.string().trim().max(20).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((v) => v.targetRepsMax >= v.targetRepsMin, {
    message: 'Reps max doit être >= reps min',
    path: ['targetRepsMax'],
  });

export type ProgramExerciseInput = z.infer<typeof programExerciseInputSchema>;
