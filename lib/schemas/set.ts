import { z } from 'zod';
import type { ExerciseCategory } from '@prisma/client';
import { MAX_DISTANCE_M, MAX_DURATION_SEC } from '@/lib/cardio';

export const setInputSchema = z.object({
  exerciseId: z.string().min(1),
  setNumber: z.coerce.number().int().min(1).max(50),
  weight: z.coerce.number().min(0).max(500),
  reps: z.coerce.number().int().min(0).max(100),
  rir: z.union([z.coerce.number().int().min(0).max(5), z.null()]).optional().nullable(),
  // Cardio fields (issue #133): only valid on CARDIO exercises - the API
  // enforces that with validateSetForCategory below, since the category lives
  // on the exercise row, not in the payload. Bounds: 1 second to 24 hours,
  // 0 to 1000 km.
  durationSec: z
    .union([z.coerce.number().int().min(1).max(MAX_DURATION_SEC), z.null()])
    .optional()
    .nullable(),
  distanceM: z
    .union([z.coerce.number().min(0).max(MAX_DISTANCE_M), z.null()])
    .optional()
    .nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isWarmup: z.boolean().optional().default(false),
  isDropSet: z.boolean().optional().default(false),
});

export type SetInput = z.infer<typeof setInputSchema>;

// Cross-field rule the schema alone cannot express: duration/distance are
// accepted only on CARDIO exercises (so strength data stays clean), and a
// cardio set requires a duration. Returns an error message or null when valid.
export function validateSetForCategory(
  category: ExerciseCategory,
  data: Pick<SetInput, 'durationSec' | 'distanceM'>,
): string | null {
  if (category === 'CARDIO') {
    if (data.durationSec == null) {
      return 'A cardio set requires a duration.';
    }
    return null;
  }
  if (data.durationSec != null || data.distanceM != null) {
    return 'Duration and distance are only valid on cardio exercises.';
  }
  return null;
}
