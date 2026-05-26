import { db } from '@/lib/db';

export interface LastPerformance {
  exerciseId: string;
  // The most recent previous session for this exercise (excluding the current session).
  sessionStartedAt: Date;
  sets: { weight: number; reps: number; rir: number | null }[];
  // Best load of the session (handy for a quick display).
  maxWeight: number;
  // Reps at that max load (the highest rep count reached at maxWeight).
  repsAtMaxWeight: number;
}

// Fetches the previous performances for a list of exerciseIds, excluding the
// current session. For each exercise, we take the most recent session that
// contains it, then pull up all of its non-warmup sets.
export async function getLastPerformances(
  userId: string,
  exerciseIds: string[],
  excludeSessionId: string | null,
): Promise<Map<string, LastPerformance>> {
  if (exerciseIds.length === 0) return new Map();

  const result = new Map<string, LastPerformance>();

  // For each exercise: find the most recent set (excluding the current session,
  // excluding warmups), get its sessionId, then all the sets of that session
  // for this exercise.
  await Promise.all(
    exerciseIds.map(async (exerciseId) => {
      const lastSet = await db.set.findFirst({
        where: {
          exerciseId,
          isWarmup: false,
          ...(excludeSessionId ? { sessionId: { not: excludeSessionId } } : {}),
          session: { userId },
        },
        orderBy: { completedAt: 'desc' },
        include: { session: { select: { startedAt: true, id: true } } },
      });
      if (!lastSet) return;

      const sets = await db.set.findMany({
        where: {
          sessionId: lastSet.sessionId,
          exerciseId,
          isWarmup: false,
        },
        orderBy: { setNumber: 'asc' },
        select: { weight: true, reps: true, rir: true },
      });

      const maxWeight = Math.max(...sets.map((s) => s.weight));
      const repsAtMaxWeight = Math.max(
        ...sets.filter((s) => s.weight === maxWeight).map((s) => s.reps),
      );

      result.set(exerciseId, {
        exerciseId,
        sessionStartedAt: lastSet.session.startedAt,
        sets,
        maxWeight,
        repsAtMaxWeight,
      });
    }),
  );

  return result;
}
