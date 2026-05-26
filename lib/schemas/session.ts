import { z } from 'zod';

export const sessionStartSchema = z.object({
  workoutId: z.string().min(1),
});

export const sessionUpdateSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  // Si true, marque finishedAt à maintenant.
  finish: z.boolean().optional(),
});

export type SessionStart = z.infer<typeof sessionStartSchema>;
export type SessionUpdate = z.infer<typeof sessionUpdateSchema>;
