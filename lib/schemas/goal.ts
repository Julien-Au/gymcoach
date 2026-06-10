import { z } from 'zod';

// Per-exercise target goal input (issue #90). The weight arrives in kg (the
// client converts from the display unit before posting, like the set form).
// For bodyweight exercises the target is the EFFECTIVE load (bodyweight +
// added load), consistent with lib/stats.ts effectiveWeight semantics.
//
// Bounds: weight mirrors the set schema's 500 kg ceiling but doubled to leave
// room for effective bodyweight loads; reps mirrors the set schema's 100 cap.
export const goalInputSchema = z.object({
  exerciseId: z.string().min(1),
  targetWeight: z.coerce.number().positive().max(1000),
  targetReps: z.coerce.number().int().min(1).max(100),
});

export type GoalInput = z.infer<typeof goalInputSchema>;
