import { z } from 'zod';

export const programInputSchema = z.object({
  name: z.string().trim().min(1, 'Name required').max(120, 'Too long'),
  phase: z.string().trim().min(1, 'Phase required').max(60),
  description: z.string().trim().max(2000).optional().nullable(),
});

export type ProgramInput = z.infer<typeof programInputSchema>;
