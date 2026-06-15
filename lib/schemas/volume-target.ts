import { z } from 'zod';

// Per-muscle weekly volume target input (issue #211). Sets the user's personal
// MEV/MRV band for one muscle group, classified against the progress-page
// volume card. The muscle group must be one of the Prisma MuscleGroup enum
// values; the band is bounded so a typo cannot store a nonsensical landmark.
//
// Bounds: mev >= 1 (a target of zero sets is not a meaningful floor), and the
// ceiling mrv must be strictly greater than mev (an empty or inverted band is
// rejected). The sane upper cap of 40 sets/week is generous - well above any
// recoverable per-muscle weekly volume in the literature - while keeping the
// value display-friendly.
export const MUSCLE_GROUPS = [
  'CHEST',
  'BACK_WIDTH',
  'BACK_THICKNESS',
  'SHOULDERS_FRONT',
  'SHOULDERS_LATERAL',
  'SHOULDERS_REAR',
  'BICEPS',
  'TRICEPS',
  'FOREARMS',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'ABS',
  'LOWER_BACK',
  'OTHER',
] as const;

export const VOLUME_TARGET_MAX = 40;

export const volumeTargetInputSchema = z
  .object({
    muscleGroup: z.enum(MUSCLE_GROUPS),
    mev: z.coerce.number().int().min(1).max(VOLUME_TARGET_MAX),
    mrv: z.coerce.number().int().min(1).max(VOLUME_TARGET_MAX),
  })
  .refine((d) => d.mrv > d.mev, {
    message: 'mrv must be greater than mev',
    path: ['mrv'],
  });

export type VolumeTargetInput = z.infer<typeof volumeTargetInputSchema>;

// The muscleGroup-only body for clearing a target (reset to default).
export const volumeTargetClearSchema = z.object({
  muscleGroup: z.enum(MUSCLE_GROUPS),
});

export type VolumeTargetClear = z.infer<typeof volumeTargetClearSchema>;
