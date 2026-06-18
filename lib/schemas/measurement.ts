import { z } from 'zod';
import { BodyMeasurementSite } from '@/lib/prisma-client';

// Body-measurement input (issue #202), mirroring the bodyweight schema (#99).
// The value arrives in cm (the client converts from the display unit before
// posting). Bounds are deliberately wide so any real tape-measure reading
// fits: 1 cm guards against zero/negative, 300 cm is far beyond any human
// girth. The site must be one of the enum values; an unknown site is rejected.
export const MEASUREMENT_MIN_CM = 1;
export const MEASUREMENT_MAX_CM = 300;

export const bodyMeasurementInputSchema = z.object({
  site: z.nativeEnum(BodyMeasurementSite),
  valueCm: z.coerce.number().min(MEASUREMENT_MIN_CM).max(MEASUREMENT_MAX_CM),
  note: z.string().max(500).optional(),
});

export type BodyMeasurementInput = z.infer<typeof bodyMeasurementInputSchema>;

// Query schema for the list endpoint: an optional site filter. Anything not a
// valid site is ignored (treated as "all sites") rather than rejected, so a
// stale or hand-edited query string degrades gracefully.
export const bodyMeasurementListQuerySchema = z.object({
  site: z.nativeEnum(BodyMeasurementSite).optional(),
});
