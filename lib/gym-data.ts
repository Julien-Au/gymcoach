import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';

export async function validateGymExerciseConfigs(
  userId: string,
  configs: Array<{ exerciseId: string; isAvailable: boolean; weightOptions: number[] }>,
) {
  const deduped = [...new Map(configs.map((config) => [config.exerciseId, config])).values()];
  if (deduped.length === 0) return deduped;
  const ownedCount = await db.exercise.count({
    where: { userId, id: { in: deduped.map((config) => config.exerciseId) } },
  });
  if (ownedCount !== deduped.length) throw new ApiError(400, 'Invalid exercise configuration.');
  return deduped;
}
