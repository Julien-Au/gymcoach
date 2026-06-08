import { TrendingUp } from 'lucide-react';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { EmptyState } from '@/components/ui/empty-state';
import { MUSCLE_GROUP_LABELS } from '@/lib/schemas/exercise';
import {
  applyBodyweight,
  exerciseProgress,
  weeklyVolumeByMuscleGroup,
} from '@/lib/stats';
import { ProgressDashboard } from '@/components/progress/progress-dashboard';

interface SearchParams {
  exerciseId?: string;
}

const RECENT_WEEKS = 12;

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const auth = await requireSession();

  // Lower bound: 12 weeks before today (Monday 00:00).
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - RECENT_WEEKS * 7);

  // All exercises with at least one non-warmup set in the period.
  const [exercisesWithSets, user] = await Promise.all([
    db.exercise.findMany({
      where: {
        userId: auth.userId,
        sets: {
          some: {
            isWarmup: false,
            completedAt: { gte: since },
            session: { userId: auth.userId },
          },
        },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, muscleGroup: true, usesBodyweight: true },
    }),
    db.user.findUnique({
      where: { id: auth.userId },
      select: { bodyweight: true },
    }),
  ]);
  const bodyweight = user?.bodyweight ?? null;
  const usesBodyweightById = new Map(
    exercisesWithSets.map((e) => [e.id, e.usesBodyweight]),
  );

  const selectedExerciseId =
    searchParams.exerciseId ?? exercisesWithSets[0]?.id;

  // Max load + 1RM for the selected exercise, over all available history.
  const exerciseSets = selectedExerciseId
    ? await db.set.findMany({
        where: {
          exerciseId: selectedExerciseId,
          isWarmup: false,
          session: { userId: auth.userId },
        },
        orderBy: { completedAt: 'asc' },
        select: {
          weight: true,
          reps: true,
          isWarmup: true,
          sessionId: true,
          session: { select: { startedAt: true } },
        },
      })
    : [];

  const selectedUsesBodyweight =
    selectedExerciseId != null
      ? (usesBodyweightById.get(selectedExerciseId) ?? false)
      : false;
  const exercisePoints = exerciseProgress(
    applyBodyweight(
      exerciseSets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        isWarmup: s.isWarmup,
        sessionId: s.sessionId,
        sessionStartedAt: s.session.startedAt,
        usesBodyweight: selectedUsesBodyweight,
      })),
      bodyweight,
    ),
  );

  // Weekly volume by muscle group over the period (12 weeks).
  const weeklySetsRaw = await db.set.findMany({
    where: {
      isWarmup: false,
      completedAt: { gte: since },
      session: { userId: auth.userId },
    },
    select: {
      weight: true,
      reps: true,
      isWarmup: true,
      exercise: { select: { muscleGroup: true, usesBodyweight: true } },
      session: { select: { startedAt: true } },
    },
  });

  const weeklyPoints = weeklyVolumeByMuscleGroup(
    applyBodyweight(
      weeklySetsRaw.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        isWarmup: s.isWarmup,
        muscleGroup: s.exercise.muscleGroup,
        sessionStartedAt: s.session.startedAt,
        usesBodyweight: s.exercise.usesBodyweight,
      })),
      bodyweight,
    ),
  );

  // Recap table: per exercise, first and last session in the period,
  // delta of the max load and the 1RM.
  const recapRows = await Promise.all(
    exercisesWithSets.map(async (exo) => {
      const sets = await db.set.findMany({
        where: {
          exerciseId: exo.id,
          isWarmup: false,
          completedAt: { gte: since },
          session: { userId: auth.userId },
        },
        orderBy: { completedAt: 'asc' },
        select: {
          weight: true,
          reps: true,
          isWarmup: true,
          sessionId: true,
          session: { select: { startedAt: true } },
        },
      });
      const points = exerciseProgress(
        applyBodyweight(
          sets.map((s) => ({
            weight: s.weight,
            reps: s.reps,
            isWarmup: s.isWarmup,
            sessionId: s.sessionId,
            sessionStartedAt: s.session.startedAt,
            usesBodyweight: exo.usesBodyweight,
          })),
          bodyweight,
        ),
      );
      const first = points[0];
      const last = points[points.length - 1];
      if (!first || !last) return null;
      return {
        exerciseId: exo.id,
        exerciseName: exo.name,
        muscleGroup: MUSCLE_GROUP_LABELS[exo.muscleGroup],
        sessions: points.length,
        firstWeight: first.maxWeight,
        firstDate: first.date,
        lastWeight: last.maxWeight,
        lastDate: last.date,
        weightDelta: +(last.maxWeight - first.maxWeight).toFixed(2),
        firstE1RM: first.estimated1RM,
        lastE1RM: last.estimated1RM,
        e1rmDelta: +(last.estimated1RM - first.estimated1RM).toFixed(1),
      };
    }),
  );
  const recap = recapRows.filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="size-6" />
          <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        </div>

        {exercisesWithSets.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No progress to show yet"
            description={`Log a few sessions and your charts and PRs will appear here, tracking the last ${RECENT_WEEKS} weeks.`}
            action={{ label: 'Log your first session', href: '/session/new' }}
          />
        ) : (
          <ProgressDashboard
            exercises={exercisesWithSets.map((e) => ({
              id: e.id,
              name: e.name,
              muscleGroup: MUSCLE_GROUP_LABELS[e.muscleGroup],
            }))}
            selectedExerciseId={selectedExerciseId}
            exercisePoints={exercisePoints}
            weeklyPoints={weeklyPoints.map((w) => ({
              weekKey: w.weekKey,
              weekStartIso: w.weekStart.toISOString(),
              byMuscleGroup: w.byMuscleGroup,
              total: w.total,
            }))}
            recap={recap}
          />
        )}
      </div>
    </main>
  );
}
