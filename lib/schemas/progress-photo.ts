import { z } from 'zod';
import { MAX_PROGRESS_PHOTO_NOTE } from '@/lib/progress-photo';

// Progress-photo upload metadata (issue #269). The image itself travels as
// the RAW request body (so the size cap applies while reading it); only the
// metadata rides in the query string and is validated here.
//
// takenAt must parse AND fall in a sane year range: JS Date.parse accepts
// dates far outside PostgreSQL's timestamp range (e.g. year 275760), which
// would pass a bare parse check and then throw deep in Prisma as a 500
// (same guard as the backup import schema).
const takenAtString = z
  .string()
  .max(40)
  .refine(
    (s) => {
      const t = Date.parse(s);
      if (Number.isNaN(t)) return false;
      const year = new Date(t).getUTCFullYear();
      return year >= 1 && year <= 9999;
    },
    { message: 'Invalid or out-of-range takenAt date' },
  );

export const progressPhotoUploadQuerySchema = z.object({
  // When absent the photo is stamped "now" server-side.
  takenAt: takenAtString.optional(),
  note: z.string().trim().max(MAX_PROGRESS_PHOTO_NOTE).optional(),
});

export type ProgressPhotoUploadQuery = z.infer<
  typeof progressPhotoUploadQuerySchema
>;
