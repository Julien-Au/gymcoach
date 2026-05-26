import { db } from '@/lib/db';

export interface LastPerformance {
  exerciseId: string;
  // La séance précédente la plus récente sur cet exercice (hors session courante).
  sessionStartedAt: Date;
  sets: { weight: number; reps: number; rir: number | null }[];
  // Meilleure charge de la séance (utile pour affichage rapide).
  maxWeight: number;
  // Reps à cette charge max (le plus haut nombre de reps atteint à maxWeight).
  repsAtMaxWeight: number;
}

// Récupère les performances précédentes pour une liste d'exerciceIds, hors
// session courante. Pour chaque exo, on prend la séance la plus récente qui
// le contient, puis on remonte tous ses sets non-warmup.
export async function getLastPerformances(
  userId: string,
  exerciseIds: string[],
  excludeSessionId: string | null,
): Promise<Map<string, LastPerformance>> {
  if (exerciseIds.length === 0) return new Map();

  const result = new Map<string, LastPerformance>();

  // Pour chaque exercice : trouver le set le plus récent (hors session courante,
  // hors warmup), récupérer son sessionId, puis tous les sets de cette session
  // sur cet exercice.
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
