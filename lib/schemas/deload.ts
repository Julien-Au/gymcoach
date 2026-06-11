import { z } from 'zod';

// One-tap planned deload week (issue #112). Starting a deload takes no
// parameters - the duration is fixed server-side (lib/deload.ts
// DELOAD_DURATION_DAYS) - so the input schema is a strict empty object: it
// accepts the bare `{}` the UI sends and rejects any attempt to smuggle in a
// custom duration or other fields.
export const deloadStartSchema = z.object({}).strict();

export type DeloadStartInput = z.infer<typeof deloadStartSchema>;
