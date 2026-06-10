import { z } from 'zod';

// Bodyweight entry input (issue #99). The weight arrives in kg (the client
// converts from the display unit before posting, like the set form). 500 kg
// mirrors the set schema's ceiling; nobody weighs more.
export const bodyweightEntryInputSchema = z.object({
  weightKg: z.coerce.number().positive().max(500),
  note: z.string().max(500).optional(),
});

export type BodyweightEntryInput = z.infer<typeof bodyweightEntryInputSchema>;
