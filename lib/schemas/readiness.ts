import { z } from 'zod';
import { MuscleGroup } from '@prisma/client';

// Pre-session readiness / soreness check-in input (issue #38). Optional and
// skippable in the UI; this schema only validates a check-in the user chose to
// submit. Soreness is a partial map of muscle group -> 1-5 rating.

const ratingScale = z.coerce.number().int().min(1).max(5);

// A partial record over the MuscleGroup enum. `.partial()` makes every key
// optional, so the user can rate only the groups they trained.
export const sorenessSchema = z
  .record(z.nativeEnum(MuscleGroup), ratingScale)
  .optional()
  .nullable();

export const readinessCheckinInputSchema = z.object({
  readiness: ratingScale,
  sleepQuality: ratingScale,
  soreness: sorenessSchema,
  note: z.string().trim().max(500).optional().nullable(),
});

export type ReadinessCheckinInput = z.infer<typeof readinessCheckinInputSchema>;
export type Soreness = Partial<Record<MuscleGroup, number>>;
