import { z } from 'zod';
import { STRONG_CSV_MAX_BYTES } from '@/lib/import/strong-csv';
import { TCX_MAX_BYTES } from '@/lib/import/tcx';

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
