import { z } from 'zod';

// Shared by the gym API and the backup restore path: any weight array that
// reaches the database is rounded to 2 decimals, deduped and sorted ascending,
// so a hand-edited or legacy file cannot store a shape the UI never produces.
export const gymWeightListSchema = z
  .array(z.coerce.number().min(0.1).max(5000))
  .max(200)
  .transform((values) =>
    [...new Set(values.map((value) => Math.round(value * 100) / 100))].sort((a, b) => a - b),
  );

export const gymExerciseConfigSchema = z.object({
  exerciseId: z.string().min(1),
  isAvailable: z.boolean().default(true),
  weightOptions: gymWeightListSchema.default([]),
});

export const gymCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  dumbbellWeights: gymWeightListSchema.default([]),
  plateWeights: gymWeightListSchema.default([]),
  barWeights: gymWeightListSchema.default([]),
  exerciseConfigs: z.array(gymExerciseConfigSchema).max(2000).default([]),
  makeActive: z.boolean().default(false),
});

export const gymUpdateSchema = gymCreateSchema.omit({ makeActive: true });

export type GymCreateInput = z.infer<typeof gymCreateSchema>;
export type GymUpdateInput = z.infer<typeof gymUpdateSchema>;
