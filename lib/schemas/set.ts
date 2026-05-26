import { z } from 'zod';

export const setInputSchema = z.object({
  exerciseId: z.string().min(1),
  setNumber: z.coerce.number().int().min(1).max(50),
  weight: z.coerce.number().min(0).max(500),
  reps: z.coerce.number().int().min(0).max(100),
  rir: z.union([z.coerce.number().int().min(0).max(5), z.null()]).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isWarmup: z.boolean().optional().default(false),
  isDropSet: z.boolean().optional().default(false),
});

export type SetInput = z.infer<typeof setInputSchema>;
