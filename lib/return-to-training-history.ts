import type {
  Exercise,
  Gym,
  GymExerciseConfig,
  MuscleGroup,
  ProgramExercise,
} from '@/lib/prisma-client';
import { db } from '@/lib/db';
import type { GymLoadConstraints } from '@/lib/gym-loads';
import {
  BASELINE_MUSCLE_VOLUME_DAYS,
  calculateReturnRecommendation,
  RECENT_MUSCLE_VOLUME_DAYS,
  type ReturnHistorySession,
  type ReturnRecommendation,
  type ReturnTrainingHistory,
} from '@/lib/return-to-training';

type ProgramExerciseForReturn = Pick<
  ProgramExercise,
  'id' | 'exerciseId' | 'targetSets' | 'targetRepsMin' | 'targetRIR'
> & {
  exercise: Pick<Exercise, 'category' | 'equipmentType' | 'usesBodyweight' | 'muscleGroup'>;
};

type GymForReturn = Pick<Gym, 'dumbbellWeights' | 'plateWeights' | 'barWeights'> & {
  exerciseConfigs: Pick<GymExerciseConfig, 'exerciseId' | 'isAvailable' | 'weightOptions'>[];
};

interface ReturnRecommendationQuery {
  userId: string;
  programExercises: ProgramExerciseForReturn[];
  excludeSessionId: string | null;
  now: Date;
  bodyweight?: number | null;
  gym?: GymForReturn | null;
}

interface ExerciseHistoryRow {
  sessionId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rir: number | null;
  isDropSet: boolean;
  completedAt: Date;
  session: { startedAt: Date };
}

interface HistoricalSetWithOrder {
  setNumber: number;
  weight: number;
  reps: number;
  rir: number | null;
  isDropSet: boolean;
}

// Builds session-only return recommendations. Nothing is persisted to the
// program: the active runner applies these targets while this session is open.
export async function getReturnToTrainingRecommendations({
  userId,
  programExercises,
  excludeSessionId,
  now,
  bodyweight = null,
  gym = null,
}: ReturnRecommendationQuery): Promise<Record<string, ReturnRecommendation>> {
  if (programExercises.length === 0) return {};

  const exerciseIds = [...new Set(programExercises.map((item) => item.exerciseId))];
  const muscleGroups = [...new Set(programExercises.map((item) => item.exercise.muscleGroup))];
  const excludedSession = excludeSessionId ? { id: { not: excludeSessionId } } : {};
  const baselineStart = new Date(
    now.getTime() - (RECENT_MUSCLE_VOLUME_DAYS + BASELINE_MUSCLE_VOLUME_DAYS) * 86_400_000,
  );
  const recentStart = new Date(now.getTime() - RECENT_MUSCLE_VOLUME_DAYS * 86_400_000);

  const [exerciseEntries, muscleLatestEntries, volumeRows] = await Promise.all([
    Promise.all(
      exerciseIds.map(async (exerciseId) => {
        const rows = await db.set.findMany({
          where: {
            exerciseId,
            isWarmup: false,
            isDropSet: false,
            reps: { gt: 0 },
            weight: { gte: 0 },
            completedAt: { lt: now },
            session: { userId, ...excludedSession },
          },
          orderBy: { completedAt: 'desc' },
          select: {
            sessionId: true,
            setNumber: true,
            weight: true,
            reps: true,
            rir: true,
            isDropSet: true,
            completedAt: true,
            session: { select: { startedAt: true } },
          },
        });
        return [exerciseId, rows] as const;
      }),
    ),
    Promise.all(
      muscleGroups.map(async (muscleGroup) => {
        const row = await db.set.findFirst({
          where: {
            isWarmup: false,
            isDropSet: false,
            reps: { gt: 0 },
            completedAt: { lt: now },
            session: { userId, ...excludedSession },
            exercise: { muscleGroup, category: { not: 'CARDIO' } },
          },
          orderBy: { completedAt: 'desc' },
          select: { completedAt: true },
        });
        return [muscleGroup, row?.completedAt ?? null] as const;
      }),
    ),
    db.set.findMany({
      where: {
        isWarmup: false,
        isDropSet: false,
        reps: { gt: 0 },
        completedAt: { gte: baselineStart, lt: now },
        session: { userId, ...excludedSession },
        exercise: {
          muscleGroup: { in: muscleGroups },
          category: { not: 'CARDIO' },
        },
      },
      select: {
        completedAt: true,
        exercise: { select: { muscleGroup: true } },
      },
    }),
  ]);

  const historiesByExercise = new Map<string, ReturnTrainingHistory>();
  const latestByMuscle = new Map<MuscleGroup, Date | null>(muscleLatestEntries);
  const recentSetsByMuscle = new Map<MuscleGroup, number>();
  const baselineSetsByMuscle = new Map<MuscleGroup, number>();

  for (const row of volumeRows) {
    const target = row.completedAt >= recentStart ? recentSetsByMuscle : baselineSetsByMuscle;
    const group = row.exercise.muscleGroup;
    target.set(group, (target.get(group) ?? 0) + 1);
  }

  const exerciseRows = new Map<string, ExerciseHistoryRow[]>(exerciseEntries);
  for (const pe of programExercises) {
    if (historiesByExercise.has(pe.exerciseId)) continue;
    const rows = exerciseRows.get(pe.exerciseId) ?? [];
    const baselineSets = baselineSetsByMuscle.get(pe.exercise.muscleGroup) ?? 0;
    historiesByExercise.set(pe.exerciseId, {
      exerciseLastPerformedAt: rows[0]?.completedAt ?? null,
      muscleLastPerformedAt: latestByMuscle.get(pe.exercise.muscleGroup) ?? null,
      recentMuscleSets: recentSetsByMuscle.get(pe.exercise.muscleGroup) ?? 0,
      baselineMuscleSetsPer28Days:
        baselineSets * (RECENT_MUSCLE_VOLUME_DAYS / BASELINE_MUSCLE_VOLUME_DAYS),
      exerciseSessions: groupHistoricalSessions(rows),
    });
  }

  return Object.fromEntries(
    programExercises.map((pe) => [
      pe.id,
      calculateReturnRecommendation({
        programExercise: pe,
        history: historiesByExercise.get(pe.exerciseId)!,
        now,
        bodyweight,
        loadConstraints: loadConstraintsFor(pe, gym),
      }),
    ]),
  );
}

function groupHistoricalSessions(rows: ExerciseHistoryRow[]): ReturnHistorySession[] {
  const sessions = new Map<
    string,
    Omit<ReturnHistorySession, 'sets'> & { sets: HistoricalSetWithOrder[] }
  >();
  for (const row of rows) {
    let session = sessions.get(row.sessionId);
    if (!session) {
      session = {
        sessionId: row.sessionId,
        performedAt: row.completedAt,
        sets: [],
      };
      sessions.set(row.sessionId, session);
    }
    session.sets.push({
      setNumber: row.setNumber,
      weight: row.weight,
      reps: row.reps,
      rir: row.rir,
      isDropSet: row.isDropSet,
    });
  }

  return [...sessions.values()].map((session) => ({
    sessionId: session.sessionId,
    performedAt: session.performedAt,
    sets: [...session.sets]
      .sort((left, right) => left.setNumber - right.setNumber)
      .map(({ weight, reps, rir, isDropSet }) => ({ weight, reps, rir, isDropSet })),
  }));
}

function loadConstraintsFor(
  pe: ProgramExerciseForReturn,
  gym: GymForReturn | null,
): GymLoadConstraints | null {
  if (!gym) return null;
  const config = gym.exerciseConfigs.find((item) => item.exerciseId === pe.exerciseId);
  return {
    equipmentType: pe.exercise.equipmentType,
    isAvailable: config?.isAvailable ?? true,
    dumbbellWeights: gym.dumbbellWeights,
    plateWeights: gym.plateWeights,
    barWeights: gym.barWeights,
    weightOptions: config?.weightOptions ?? [],
  };
}
