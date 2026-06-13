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
  // Cardio totals for the session (issue #176): summed duration/distance and
  // an averaged heart rate across the session's cardio sets. Null for strength
  // exercises (no cardio sets), so the session UI can branch on `cardio`.
  cardio: { durationSec: number; distanceM: number; avgHr: number | null } | null;
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

      const rows = await db.set.findMany({
        where: {
          sessionId: lastSet.sessionId,
          exerciseId,
          isWarmup: false,
        },
        orderBy: { setNumber: 'asc' },
        select: {
          weight: true,
          reps: true,
          rir: true,
          durationSec: true,
          distanceM: true,
          avgHr: true,
        },
      });

      const sets = rows.map(({ weight, reps, rir }) => ({ weight, reps, rir }));

      const maxWeight = Math.max(...sets.map((s) => s.weight));
      const repsAtMaxWeight = Math.max(
        ...sets.filter((s) => s.weight === maxWeight).map((s) => s.reps),
      );

      // Cardio totals (issue #176): a cardio set carries durationSec != null.
      // Sum duration/distance over the session's cardio sets and average the
      // heart rate across the sets that recorded one. Null when there are no
      // cardio sets (a strength exercise), so the UI branches cleanly.
      const cardioRows = rows.filter((r) => r.durationSec != null);
      let cardio: LastPerformance['cardio'] = null;
      if (cardioRows.length > 0) {
        const durationSec = cardioRows.reduce((acc, r) => acc + (r.durationSec ?? 0), 0);
        const distanceM = cardioRows.reduce((acc, r) => acc + (r.distanceM ?? 0), 0);
        const hrRows = cardioRows.filter((r) => r.avgHr != null);
        const avgHr =
          hrRows.length > 0
            ? Math.round(hrRows.reduce((acc, r) => acc + (r.avgHr ?? 0), 0) / hrRows.length)
            : null;
        cardio = { durationSec, distanceM, avgHr };
      }

      result.set(exerciseId, {
        exerciseId,
        sessionStartedAt: lastSet.session.startedAt,
        sets,
        maxWeight,
        repsAtMaxWeight,
        cardio,
      });
    }),
  );

  return result;
}
