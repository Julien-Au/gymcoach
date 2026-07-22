import { z } from 'zod';

const weightList = z
  .array(z.coerce.number().min(0.1).max(5000))
  .max(200)
  .transform((values) =>
    [...new Set(values.map((value) => Math.round(value * 100) / 100))].sort((a, b) => a - b),
  );

export const gymExerciseConfigSchema = z.object({
  exerciseId: z.string().min(1),
  isAvailable: z.boolean().default(true),
  weightOptions: weightList.default([]),
});

export const gymCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  dumbbellWeights: weightList.default([]),
  plateWeights: weightList.default([]),
  barWeights: weightList.default([]),
  exerciseConfigs: z.array(gymExerciseConfigSchema).max(2000).default([]),
  makeActive: z.boolean().default(false),
});

export const gymUpdateSchema = gymCreateSchema.omit({ makeActive: true });

export type GymCreateInput = z.infer<typeof gymCreateSchema>;
export type GymUpdateInput = z.infer<typeof gymUpdateSchema>;
