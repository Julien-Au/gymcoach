import { z } from 'zod';
import { STRONG_CSV_MAX_BYTES } from '@/lib/import/strong-csv';
import { TCX_MAX_BYTES } from '@/lib/import/tcx';
import { GPX_MAX_BYTES } from '@/lib/import/gpx';
import { FIT_MAX_BYTES } from '@/lib/import/fit';

// Strong CSV import request (issue #100). The csv field carries the raw file
// text (untrusted): the size cap is enforced here AND on the content-length
// before parsing. `unit` is the unit the Strong app was set to when exporting
// (a unit suffix in the CSV header overrides it); `mode` separates the
// read-only dry-run preview from the transactional confirm.
export const strongImportInputSchema = z.object({
  csv: z.string().min(1).max(STRONG_CSV_MAX_BYTES, 'File too large: the limit is 5 MB.'),
  unit: z.enum(['KG', 'LB']).default('KG'),
  mode: z.enum(['preview', 'confirm']),
});

export type StrongImportInput = z.infer<typeof strongImportInputSchema>;

// Hevy CSV import request (issue #113). Same cap and modes; no unit field -
// Hevy exports weight in kg (the lbs header variant is converted by the
// parser, not chosen by the user).
export const hevyImportInputSchema = z.object({
  csv: z.string().min(1).max(STRONG_CSV_MAX_BYTES, 'File too large: the limit is 5 MB.'),
  mode: z.enum(['preview', 'confirm']),
});

export type HevyImportInput = z.infer<typeof hevyImportInputSchema>;

// TCX cardio import request (issue #152). The xml field carries the raw file
// text (untrusted XML - the parser refuses DTDs/entities by construction and
// the size cap is enforced here AND on the streamed body read); same
// preview/confirm modes as the CSV imports.
export const tcxImportInputSchema = z.object({
  xml: z.string().min(1).max(TCX_MAX_BYTES, 'File too large: the limit is 5 MB.'),
  mode: z.enum(['preview', 'confirm']),
});

export type TcxImportInput = z.infer<typeof tcxImportInputSchema>;

// GPX track import request (issue #204). The gpx field carries the raw file
// text (untrusted XML - lib/import/gpx.ts refuses DTDs/entities by
// construction, caps the trackpoint count, and the size cap is enforced here
// AND on the streamed body read); same preview/confirm modes as the others.
export const gpxImportInputSchema = z.object({
  gpx: z.string().min(1).max(GPX_MAX_BYTES, 'File too large: the limit is 5 MB.'),
  mode: z.enum(['preview', 'confirm']),
});

export type GpxImportInput = z.infer<typeof gpxImportInputSchema>;

// FIT activity import request (issue #249). FIT is a BINARY format, so each file
// is carried base64-encoded; the route decodes it to bytes for the parser.
// Base64 inflates by ~4/3, so the per-file string cap is the byte cap scaled up
// (the parser re-checks the decoded length against FIT_MAX_BYTES).
//
// A single file rides in `fit` (the original contract, kept for compatibility);
// a batch (issue #253, "import my whole watch history") rides in `fits`, capped
// at FIT_MAX_BATCH files. At least one of the two must be present; if both are
// sent the route takes the batch path (`fits` wins). Same preview/confirm modes
// as the other imports.
export const FIT_MAX_BATCH = 50;
const fitFileString = z
  .string()
  .min(1)
  .max(Math.ceil(FIT_MAX_BYTES * 1.4), 'File too large: the limit is 5 MB.');

export const fitImportInputSchema = z
  .object({
    fit: fitFileString.optional(),
    fits: z.array(fitFileString).min(1).max(FIT_MAX_BATCH).optional(),
    mode: z.enum(['preview', 'confirm']),
  })
  .refine((d) => d.fit !== undefined || d.fits !== undefined, {
    message: 'Provide a FIT file.',
  });

export type FitImportInput = z.infer<typeof fitImportInputSchema>;
