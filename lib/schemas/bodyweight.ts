import { z } from 'zod';

// Bodyweight entry input (issue #99). The weight arrives in kg (the client
// converts from the display unit before posting, like the set form). The
// bounds match the profile route's bodyweight field (20-300 kg): an entry
// syncs into User.bodyweight, so it must never accept a value the profile
// would reject (issue #107).
export const bodyweightEntryInputSchema = z.object({
  weightKg: z.coerce.number().min(20).max(300),
  note: z.string().max(500).optional(),
});

export type BodyweightEntryInput = z.infer<typeof bodyweightEntryInputSchema>;
