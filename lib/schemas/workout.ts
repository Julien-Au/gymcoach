import { z } from 'zod';

const dayOfWeekSchema = z
  .union([z.coerce.number().int().min(1).max(7), z.literal('').transform(() => null), z.null()])
  .transform((v) => (typeof v === 'number' ? v : null))
  .optional()
  .nullable();

export const workoutInputSchema = z.object({
  name: z.string().trim().min(1, 'Name required').max(120),
  dayOfWeek: dayOfWeekSchema,
});

export type WorkoutInput = z.infer<typeof workoutInputSchema>;

export const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
