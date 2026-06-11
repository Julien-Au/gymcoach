import { TrendingUp } from 'lucide-react';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { EmptyState } from '@/components/ui/empty-state';
import { MUSCLE_GROUP_LABELS } from '@/lib/schemas/exercise';
import {
  applyBodyweight,
  best1RM,
  classifyWeeklySets,
  exerciseProgress,
  isStalled,
  isoWeekKey,
  trainingConsistency,
  weeklyConditioning,
  weeklySetsByMuscleGroup,
  weeklyVolumeByMuscleGroup,
  WEEKLY_SETS_MEV,
  WEEKLY_SETS_MRV,
} from '@/lib/stats';
import {
  DELOAD_READINESS_LOOKBACK,
  DELOAD_READINESS_MAX_AGE_DAYS,
  isDeloadActive,
  recommendDeload,
} from '@/lib/deload';
import { ProgressDashboard } from '@/components/progress/progress-dashboard';
import { ConsistencyCard } from '@/components/progress/consistency-card';
import { DeloadBanner } from '@/components/progress/deload-banner';
import { BodyweightCard } from '@/components/progress/bodyweight-card';
import { ConditioningCard } from '@/components/progress/conditioning-card';

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
        // The lifting selector/recap only makes sense for weight x reps work;
        // cardio exercises (issue #133) have no load chart to show here (a
        // dedicated conditioning view is the follow-up, issue #135).
        category: { not: 'CARDIO' },
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
      select: { bodyweight: true, unit: true, weeklyFrequency: true, deloadUntil: true },
    }),
  ]);
  const bodyweight = user?.bodyweight ?? null;
  const unit = user?.unit ?? 'KG';
  const usesBodyweightById = new Map(
    exercisesWithSets.map((e) => [e.id, e.usesBodyweight]),
  );

  // Finished sessions over the window, for the consistency card.
  const finishedSessions = await db.session.findMany({
    where: {
      userId: auth.userId,
      finishedAt: { not: null },
      startedAt: { gte: since },
    },
    select: { startedAt: true },
  });
  const consistency = trainingConsistency(
    finishedSessions.map((s) => s.startedAt),
    { weeklyFrequency: user?.weeklyFrequency ?? null, windowWeeks: RECENT_WEEKS },
  );

  const selectedExerciseId =
    searchParams.exerciseId ?? exercisesWithSets[0]?.id;

  // Max load + 1RM for the selected exercise, over all available history,
  // plus its target goal (issue #90) fetched in parallel.
  const [exerciseSets, selectedGoal] = await Promise.all([
    selectedExerciseId
      ? db.set.findMany({
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
            durationSec: true,
            sessionId: true,
            session: { select: { startedAt: true } },
          },
        })
      : Promise.resolve([]),
    selectedExerciseId
      ? db.exerciseGoal.findUnique({
          where: {
            userId_exerciseId: { userId: auth.userId, exerciseId: selectedExerciseId },
          },
        })
      : Promise.resolve(null),
  ]);

  const selectedUsesBodyweight =
    selectedExerciseId != null
      ? (usesBodyweightById.get(selectedExerciseId) ?? false)
      : false;
  const adjustedExerciseSets = applyBodyweight(
    exerciseSets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      isWarmup: s.isWarmup,
      durationSec: s.durationSec,
      sessionId: s.sessionId,
      sessionStartedAt: s.session.startedAt,
      usesBodyweight: selectedUsesBodyweight,
    })),
    bodyweight,
  );
  const exercisePoints = exerciseProgress(adjustedExerciseSets);

  // The goal is measured against the best bodyweight-adjusted e1RM over the
  // full history loaded above.
  const selectedBestE1RM = best1RM(adjustedExerciseSets);

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
      durationSec: true,
      distanceM: true,
      sessionId: true,
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
        durationSec: s.durationSec,
        muscleGroup: s.exercise.muscleGroup,
        sessionStartedAt: s.session.startedAt,
        usesBodyweight: s.exercise.usesBodyweight,
      })),
      bodyweight,
    ),
  );

  // Weekly working-set count per muscle group, for the MEV/MRV reference band.
  // Set counts are load-agnostic, so no bodyweight adjustment is needed.
  const weeklySetsPoints = weeklySetsByMuscleGroup(
    weeklySetsRaw.map((s) => ({
      isWarmup: s.isWarmup,
      durationSec: s.durationSec,
      muscleGroup: s.exercise.muscleGroup,
      sessionStartedAt: s.session.startedAt,
    })),
  );

  // Classify the most recent completed (non-current) week against the band so
  // the dashboard can flag below MEV / within / above MRV per muscle group.
  // Falling back to the latest available week keeps a signal when only the
  // current week has data.
  const currentWeekKey = isoWeekKey(new Date());
  const latestCompletedWeek =
    [...weeklySetsPoints]
      .reverse()
      .find((w) => w.weekKey !== currentWeekKey) ??
    weeklySetsPoints[weeklySetsPoints.length - 1];
  const volumeLandmarks = latestCompletedWeek
    ? {
        weekKey: latestCompletedWeek.weekKey,
        mev: WEEKLY_SETS_MEV,
        mrv: WEEKLY_SETS_MRV,
        byMuscleGroup: Object.fromEntries(
          Object.entries(latestCompletedWeek.byMuscleGroup).map(
            ([group, sets]) => [
              group,
              { sets, zone: classifyWeeklySets(sets) },
            ],
          ),
        ),
      }
    : null;

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
          durationSec: true,
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
            durationSec: s.durationSec,
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
        // Read-only flag: e1RM has not improved over the recent sessions.
        stalled: isStalled(points.map((p) => p.estimated1RM)),
      };
    }),
  );
  const recap = recapRows.filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  // Program-level deload recommendation: aggregates the stalled flags above
  // with the most recent readiness check-ins. Display-only. Stale check-ins
  // are excluded so the trigger reflects the current block, not dead data.
  const readinessSince = new Date();
  readinessSince.setUTCDate(
    readinessSince.getUTCDate() - DELOAD_READINESS_MAX_AGE_DAYS,
  );
  const recentCheckins = await db.readinessCheckin.findMany({
    where: { userId: auth.userId, createdAt: { gte: readinessSince } },
    orderBy: { createdAt: 'desc' },
    take: DELOAD_READINESS_LOOKBACK,
    select: { readiness: true },
  });
  // Bodyweight trend (issue #99): entries of the last 12 weeks, newest first.
  // Independent of training data, so the card renders even on the empty state.
  const bodyweightEntries = await db.bodyweightEntry.findMany({
    where: { userId: auth.userId, measuredAt: { gte: since } },
    orderBy: { measuredAt: 'desc' },
    select: { id: true, weightKg: true, measuredAt: true },
  });

  // Conditioning card (issue #135, display-only): weekly cardio minutes /
  // distance / sessions over the last 8 weeks, derived from the cardio sets
  // already fetched for the window. The card stays hidden until the user has
  // logged at least one cardio set EVER (not just in the window), so a brand
  // new axis never shows an empty chart unprompted.
  const hasCardioSets =
    (await db.set.count({
      where: { durationSec: { not: null }, session: { userId: auth.userId } },
    })) > 0;
  const conditioningWeeks = hasCardioSets
    ? weeklyConditioning(
        weeklySetsRaw
          .filter((s) => s.durationSec != null)
          .map((s) => ({
            durationSec: s.durationSec,
            distanceM: s.distanceM,
            isWarmup: s.isWarmup,
            sessionId: s.sessionId,
            sessionStartedAt: s.session.startedAt,
          })),
        { windowWeeks: 8 },
      )
    : null;

  const deload = recommendDeload({
    stalledExerciseNames: recap
      .filter((r) => r.stalled)
      .map((r) => r.exerciseName),
    recentReadiness: recentCheckins.map((c) => c.readiness),
  });

  // Active planned deload week (issue #112): only a future deloadUntil counts;
  // an expired one reads as inactive without any cleanup write.
  const deloadActive = isDeloadActive(user?.deloadUntil ?? null, new Date());
  const deloadUntilIso = deloadActive ? user!.deloadUntil!.toISOString() : null;

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="size-6" />
          <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        </div>

        <BodyweightCard
          entries={bodyweightEntries.map((e) => ({
            id: e.id,
            weightKg: e.weightKg,
            measuredAt: e.measuredAt.toISOString(),
          }))}
          unit={unit}
        />

        {conditioningWeeks && (
          <ConditioningCard
            weeks={conditioningWeeks.map((w) => ({
              weekKey: w.weekKey,
              weekStartIso: w.weekStart.toISOString(),
              minutes: w.minutes,
              distanceKm: w.distanceKm,
              sessions: w.sessions,
            }))}
          />
        )}

        {exercisesWithSets.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No progress to show yet"
            description={`Log a few sessions and your charts and PRs will appear here, tracking the last ${RECENT_WEEKS} weeks.`}
            action={{ label: 'Log your first session', href: '/session/new' }}
          />
        ) : (
          <>
            {(deload.recommended || deloadActive) && (
              <DeloadBanner reasons={deload.reasons} deloadUntil={deloadUntilIso} />
            )}
            <ConsistencyCard
              weeks={consistency.weeks}
              currentStreak={consistency.currentStreak}
              weeklyFrequency={consistency.weeklyFrequency}
            />
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
              volumeLandmarks={volumeLandmarks}
              recap={recap}
              unit={unit}
              selectedGoal={
                selectedGoal
                  ? {
                      id: selectedGoal.id,
                      targetWeight: selectedGoal.targetWeight,
                      targetReps: selectedGoal.targetReps,
                      achievedAt: selectedGoal.achievedAt?.toISOString() ?? null,
                    }
                  : null
              }
              selectedBestE1RM={selectedBestE1RM}
              selectedUsesBodyweight={selectedUsesBodyweight}
            />
          </>
        )}
      </div>
    </main>
  );
}
