'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flag, MessageSquare, X } from 'lucide-react';
import type {
  Exercise,
  Program,
  ProgramExercise,
  Session,
  Set as PrismaSet,
  WeightUnit,
  Workout,
  Gym,
  GymExerciseConfig,
} from '@/lib/prisma-client';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { acquireWakeLock, bindWakeLockToVisibility, releaseWakeLock } from '@/lib/wake-lock';
import { vibrate, VIBRATION_PATTERNS } from '@/lib/vibrate';
import { generateLocalId, getDB, type PendingSet } from '@/lib/indexeddb';
import {
  READINESS_HOLD_AT_OR_BELOW,
  READINESS_RECENCY_HOURS,
  SORENESS_HOLD_AT_OR_ABOVE,
  readinessForSuggestion,
  type ReadinessSignal,
} from '@/lib/progression';
import { recommendNextIntraSet, type IntraSetRecommendation } from '@/lib/intra-set-autoregulation';
import {
  buildSupersetView,
  isSupersetTransitionRest,
  nextAutoAdvanceIndex,
  nextNavIndex,
  SUPERSET_TRANSITION_REST_SEC,
} from '@/lib/supersets';
import { isReadinessAutoRegulationEnabled } from '@/lib/preferences';
import { bindAutoSync, flushPendingSets, queueSet } from '@/lib/sync';
import { hydrateFromServerSets } from '@/lib/sync-hydration';
import { ExerciseCard } from '@/components/session/exercise-card';
import { SetsList } from '@/components/session/sets-list';
import { SetInput } from '@/components/session/set-input';
import { RestTimer } from '@/components/session/rest-timer';
import { SessionSummary } from '@/components/session/session-summary';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { useTrainingName } from '@/components/shared/use-training-name';
import type { GymLoadConstraints } from '@/lib/gym-loads';

export interface SerializedLastPerformance {
  sessionStartedAt: string;
  sets: { weight: number; reps: number; rir: number | null }[];
  maxWeight: number;
  repsAtMaxWeight: number;
  // Cardio totals for the last session (issue #176): null for strength
  // exercises. Carried so the exercise card can show a cardio "Last session"
  // reference (duration / distance / avgHr).
  cardio: { durationSec: number; distanceM: number; avgHr: number | null } | null;
}

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };

type SessionRunnerProps = {
  session: Session & {
    workout:
      | (Workout & {
          program: Pick<Program, 'id' | 'name'> | null;
          exercises: ProgramExerciseWithExercise[];
        })
      | null;
    sets: PrismaSet[];
    gym: (Gym & { exerciseConfigs: GymExerciseConfig[] }) | null;
  };
  lastPerformances: Record<string, SerializedLastPerformance>;
  // Latest in-window readiness check-in (or null). Drives whether the load
  // suggestion is held/reduced and the matching explainer in the UI.
  readiness: ReadinessSignal | null;
  // True while the user runs a planned deload week (issue #112): suggestions
  // step down and the runner shows a "Deload week" badge.
  deloadActive: boolean;
  unit: WeightUnit;
};

type Mode =
  | { kind: 'input' }
  | { kind: 'rest'; endsAt: number; totalSec: number; nextExerciseIdx: number | null }
  | { kind: 'summary' };

export function SessionRunner({
  session,
  lastPerformances,
  readiness,
  deloadActive,
  unit,
}: SessionRunnerProps) {
  const t = useTranslations('session');
  const exerciseName = useExerciseName();
  const trainingName = useTrainingName();
  const router = useRouter();
  const workout = session.workout!;
  // Supersets (issue #146, slice 1): run the workout in presentation order -
  // members of a superset group come consecutively with A1/A2 labels. For a
  // workout without supersets this is exactly the stored order.
  const supersetView = useMemo(() => buildSupersetView(workout.exercises), [workout.exercises]);
  const programExercises = supersetView.ordered;

  const [hydrated, setHydrated] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: 'input' });
  const [closing, setClosing] = useState(false);
  // Readiness auto-regulation can be turned off in settings (issue #61). The
  // preference lives in localStorage, so it is read after mount; until then we
  // assume the default (on) so the first render matches the server output.
  const [autoRegulate, setAutoRegulate] = useState(true);

  const currentPE = programExercises[currentIdx];

  // When auto-regulation is off, the readiness signal is dropped entirely, so
  // the suggestion falls back to pure programmed progression (pre-#55 behavior).
  const effectiveReadiness = readinessForSuggestion(readiness, autoRegulate);

  // Hydrate IndexedDB with the server sets, then enable auto-sync.
  useEffect(() => {
    setAutoRegulate(isReadinessAutoRegulationEnabled());
    void (async () => {
      await hydrateFromServerSets(session.id, session.sets);
      setHydrated(true);
    })();
    void acquireWakeLock();
    const cleanupVisibility = bindWakeLockToVisibility();
    const cleanupSync = bindAutoSync();
    return () => {
      void releaseWakeLock();
      cleanupVisibility();
      cleanupSync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live query: all sets of this session, from IndexedDB.
  const liveSets = useLiveQuery(
    async () => {
      const db = getDB();
      const items = await db.pendingSets.where('sessionId').equals(session.id).toArray();
      items.sort((a, b) => a.exerciseId.localeCompare(b.exerciseId) || a.setNumber - b.setNumber);
      return items;
    },
    [session.id],
    [] as PendingSet[],
  );

  const setsByExercise = useMemo(() => {
    const out = new Map<string, PendingSet[]>();
    for (const s of liveSets) {
      if (!out.has(s.exerciseId)) out.set(s.exerciseId, []);
      out.get(s.exerciseId)!.push(s);
    }
    for (const arr of out.values()) {
      arr.sort((a, b) => a.setNumber - b.setNumber);
    }
    return out;
  }, [liveSets]);

  const programExerciseByExerciseId = useMemo(
    () => new Map(programExercises.map((pe) => [pe.exerciseId, pe])),
    [programExercises],
  );

  function recommendationFor(
    pe: ProgramExerciseWithExercise,
    atMs: number,
  ): IntraSetRecommendation | null {
    const completedSets = setsByExercise.get(pe.exerciseId) ?? [];
    const lastWorkingSet = completedSets.filter((set) => !set.isWarmup && !set.isDropSet).at(-1);
    if (!lastWorkingSet) return null;

    const interveningSet = liveSets
      .filter(
        (set) =>
          !set.isWarmup &&
          !set.isDropSet &&
          set.exerciseId !== pe.exerciseId &&
          set.createdAt > lastWorkingSet.createdAt,
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    const interveningPe = interveningSet
      ? programExerciseByExerciseId.get(interveningSet.exerciseId)
      : undefined;
    const sameMuscleSuperset = Boolean(
      interveningPe &&
      pe.supersetGroup != null &&
      interveningPe.supersetGroup === pe.supersetGroup &&
      interveningPe.exercise.muscleGroup === pe.exercise.muscleGroup,
    );

    const freshReadiness =
      effectiveReadiness != null && effectiveReadiness.ageHours <= READINESS_RECENCY_HOURS;
    const groupSoreness = effectiveReadiness?.soreness?.[pe.exercise.muscleGroup];
    const recoveryBlocksIncrease =
      freshReadiness &&
      (effectiveReadiness.readiness <= READINESS_HOLD_AT_OR_BELOW ||
        (typeof groupSoreness === 'number' && groupSoreness >= SORENESS_HOLD_AT_OR_ABOVE));
    const allowLoadIncrease = !deloadActive && !recoveryBlocksIncrease;

    return recommendNextIntraSet({
      programExercise: pe,
      completedSets,
      recoverySec: Math.max(0, (atMs - lastWorkingSet.createdAt) / 1000),
      sameMuscleSuperset,
      allowLoadIncrease,
      loadConstraints: loadConstraintsFor(pe),
    });
  }

  function loadConstraintsFor(pe: ProgramExerciseWithExercise): GymLoadConstraints | null {
    if (!session.gym) return null;
    const config = session.gym.exerciseConfigs.find((item) => item.exerciseId === pe.exerciseId);
    return {
      equipmentType: pe.exercise.equipmentType,
      isAvailable: config?.isAvailable ?? true,
      dumbbellWeights: session.gym.dumbbellWeights,
      plateWeights: session.gym.plateWeights,
      barWeights: session.gym.barWeights,
      weightOptions: config?.weightOptions ?? [],
    };
  }

  // Prior-session sets per exercise, the PR baseline for the post-session
  // summary (same source as the in-session badge: getLastPerformances).
  const priorSetsByExercise = useMemo(() => {
    const out: Record<string, { weight: number; reps: number }[]> = {};
    for (const [exerciseId, perf] of Object.entries(lastPerformances)) {
      out[exerciseId] = perf.sets.map((s) => ({ weight: s.weight, reps: s.reps }));
    }
    return out;
  }, [lastPerformances]);

  const completedExerciseCount = useMemo(() => {
    let count = 0;
    for (const pe of programExercises) {
      const done = setsByExercise.get(pe.exerciseId)?.filter((s) => !s.isWarmup).length ?? 0;
      if (done >= pe.targetSets) count += 1;
    }
    return count;
  }, [programExercises, setsByExercise]);

  const progressPct =
    programExercises.length === 0
      ? 0
      : Math.round((completedExerciseCount / programExercises.length) * 100);

  async function handleValidate(values: {
    weight: number;
    reps: number;
    rir: number | null;
    durationSec: number | null;
    distanceM: number | null;
    isWarmup: boolean;
    isDropSet: boolean;
    notes: string | null;
  }) {
    if (!currentPE) return;
    const existing = setsByExercise.get(currentPE.exerciseId) ?? [];
    const setNumber = (existing.at(-1)?.setNumber ?? 0) + 1;

    // Optimistic write: immediate insert into IndexedDB (status pending),
    // instant display via useLiveQuery, and a background POST attempt.
    await queueSet({
      localId: generateLocalId(),
      sessionId: session.id,
      exerciseId: currentPE.exerciseId,
      setNumber,
      weight: values.weight,
      reps: values.reps,
      rir: values.rir,
      durationSec: values.durationSec,
      distanceM: values.distanceM,
      notes: values.notes,
      isWarmup: values.isWarmup,
      isDropSet: values.isDropSet,
    });

    vibrate(VIBRATION_PATTERNS.validate);

    // Start the rest, preparing the auto-advance at the end of the timer.
    // Standalone exercise (unchanged behavior): advance once the set
    // completes the target. Superset member (issue #146): alternate to the
    // next member of the group that still has sets, the A1/A2 flow.
    const remainingAfterThisSet = (pe: ProgramExerciseWithExercise) => {
      const logged = setsByExercise.get(pe.exerciseId)?.filter((s) => !s.isWarmup).length ?? 0;
      const justLogged = pe.exerciseId === currentPE.exerciseId ? 1 : 0;
      return pe.targetSets - logged - justLogged;
    };
    const nextIdx = values.isWarmup
      ? null
      : nextAutoAdvanceIndex(supersetView, currentIdx, remainingAfterThisSet);

    // Superset-aware rest (issue #189): a short transition rest when the
    // auto-advance moves to another member of the same group (A1 -> A2); the
    // full per-exercise rest after the last member and for standalone work.
    const transition = isSupersetTransitionRest(supersetView, currentIdx, nextIdx);
    const restSec = transition ? SUPERSET_TRANSITION_REST_SEC : currentPE.restSec;

    setMode({
      kind: 'rest',
      endsAt: Date.now() + restSec * 1000,
      totalSec: restSec,
      nextExerciseIdx: nextIdx,
    });
  }

  async function handleDeleteSet(set: PendingSet) {
    const db = getDB();
    // If already synced: API DELETE call, then local removal.
    // If not yet synced: local removal only.
    if (set.serverId) {
      const res = await fetch(`/api/sets/${set.serverId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        toast.error(t('setDeleteError'));
        return;
      }
    }
    await db.pendingSets.delete(set.localId);
    toast.success(t('setDeleted'));
  }

  async function handleFinishSession() {
    setClosing(true);
    try {
      // Attempt one last flush before closing, to minimize the residual queue.
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await flushPendingSets();
      }
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finish: true }),
      });
      if (!res.ok) {
        toast.error(t('finishError'));
        return;
      }
      toast.success(t('finished'));
      router.replace('/');
      router.refresh();
    } finally {
      setClosing(false);
    }
  }

  function handleRestEnd() {
    vibrate(VIBRATION_PATTERNS.restEnd);
    if (mode.kind === 'rest' && mode.nextExerciseIdx != null) {
      setCurrentIdx(mode.nextExerciseIdx);
    }
    setMode({ kind: 'input' });
  }

  function handleSkipRest() {
    if (mode.kind === 'rest' && mode.nextExerciseIdx != null) {
      setCurrentIdx(mode.nextExerciseIdx);
    }
    setMode({ kind: 'input' });
  }

  function handleAdd30s() {
    if (mode.kind !== 'rest') return;
    setMode({ ...mode, endsAt: mode.endsAt + 30_000 });
  }

  function goPrev() {
    setCurrentIdx((i) => Math.max(0, i - 1));
    setMode({ kind: 'input' });
  }
  // Next is linear for standalone exercises (unchanged) and cycles within a
  // superset group before advancing past it (issue #146).
  const remainingNow = (pe: ProgramExerciseWithExercise) =>
    pe.targetSets - (setsByExercise.get(pe.exerciseId)?.filter((s) => !s.isWarmup).length ?? 0);
  const navNextIdx = nextNavIndex(supersetView, currentIdx, remainingNow);
  function goNext() {
    if (navNextIdx == null) return;
    setCurrentIdx(navNextIdx);
    setMode({ kind: 'input' });
  }

  if (mode.kind === 'summary') {
    return (
      <SessionSummary
        session={session}
        sets={liveSets}
        programExercises={programExercises}
        unit={unit}
        priorSets={priorSetsByExercise}
        onBack={() => setMode({ kind: 'input' })}
        onFinish={handleFinishSession}
        finishing={closing}
      />
    );
  }

  if (!currentPE) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-6">
        <p className="text-muted-foreground">{t('noExercises')}</p>
      </main>
    );
  }

  const lastPerf = lastPerformances[currentPE.exerciseId];
  const currentSets = setsByExercise.get(currentPE.exerciseId) ?? [];
  const currentRecommendation = recommendationFor(currentPE, Date.now());
  const restNextPe =
    mode.kind === 'rest'
      ? mode.nextExerciseIdx != null
        ? (programExercises[mode.nextExerciseIdx] ?? null)
        : currentSets.filter((set) => !set.isWarmup).length < currentPE.targetSets
          ? currentPE
          : null
      : null;
  const restRecommendation =
    mode.kind === 'rest' && restNextPe ? recommendationFor(restNextPe, mode.endsAt) : null;

  return (
    <main className="flex flex-1 flex-col">
      {/* Sticky header with progress and exit button */}
      <div className="sticky top-[97px] z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{trainingName(workout.name)}</p>
            <p className="text-sm font-medium">
              {t('exerciseProgress', {
                current: currentIdx + 1,
                total: programExercises.length,
                name: exerciseName(currentPE.exercise.name),
              })}
            </p>
            {supersetView.labels.has(currentPE.id) && (
              <Badge variant="secondary" className="mt-1">
                {t('superset', { label: supersetView.labels.get(currentPE.id) ?? '' })}
              </Badge>
            )}
            {deloadActive && (
              <Badge variant="secondary" className="mt-1 text-emerald-700 dark:text-emerald-400">
                {t('deloadWeek')}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground"
            aria-label={t('quit')}
          >
            <Link href="/">
              <X className="size-4" />
            </Link>
          </Button>
        </div>
        <Progress value={progressPct} className="mt-2 h-1.5" />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4">
        <ExerciseCard
          programExercise={currentPE}
          lastPerformance={lastPerf}
          readiness={effectiveReadiness}
          deloadActive={deloadActive}
          unit={unit}
          gymName={session.gym?.name ?? null}
          loadConstraints={loadConstraintsFor(currentPE)}
        />

        <SetsList
          programExercise={currentPE}
          sets={currentSets}
          isInputActive={mode.kind === 'input'}
          onDeleteSet={handleDeleteSet}
          priorSets={lastPerf?.sets}
        />

        {!hydrated ? null : mode.kind === 'input' ? (
          <SetInput
            programExercise={currentPE}
            existingSets={currentSets}
            lastPerformance={lastPerf}
            readiness={effectiveReadiness}
            deloadActive={deloadActive}
            unit={unit}
            recommendation={currentRecommendation}
            loadConstraints={loadConstraintsFor(currentPE)}
            onSubmit={handleValidate}
          />
        ) : (
          <RestTimer
            endsAt={mode.endsAt}
            totalSec={mode.totalSec}
            nextLabel={restNextPe ? exerciseName(restNextPe.exercise.name) : null}
            recommendation={restRecommendation}
            unit={unit}
            onEnd={handleRestEnd}
            onSkip={handleSkipRest}
            onAdd30={handleAdd30s}
          />
        )}

        {/* In-session coach access (issue #111): opens the chat with this
            session attached so the advice is grounded in the live workout.
            Always available, never auto-triggered. */}
        <Button variant="outline" size="sm" asChild className="min-h-tap">
          <Link href={`/chat?sessionId=${session.id}`}>
            <MessageSquare className="size-4" />
            <span className="ml-2">{t('askCoach')}</span>
          </Link>
        </Button>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={currentIdx === 0 || mode.kind !== 'input'}
            className="min-h-tap"
          >
            <ChevronLeft className="size-4" />
            <span className="ml-1">{t('previous')}</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setMode({ kind: 'summary' })}
            className="min-h-tap"
          >
            <Flag className="size-4" />
            <span className="ml-2">{t('finish')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={navNextIdx == null || mode.kind !== 'input'}
            className="min-h-tap"
          >
            <span className="mr-1">{t('next')}</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
