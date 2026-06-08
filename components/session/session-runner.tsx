'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flag, X } from 'lucide-react';
import type {
  Exercise,
  Program,
  ProgramExercise,
  Session,
  Set as PrismaSet,
  WeightUnit,
  Workout,
} from '@prisma/client';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { acquireWakeLock, bindWakeLockToVisibility, releaseWakeLock } from '@/lib/wake-lock';
import { vibrate, VIBRATION_PATTERNS } from '@/lib/vibrate';
import {
  generateLocalId,
  getDB,
  type PendingSet,
} from '@/lib/indexeddb';
import { bindAutoSync, flushPendingSets, queueSet } from '@/lib/sync';
import { hydrateFromServerSets } from '@/lib/sync-hydration';
import { ExerciseCard } from '@/components/session/exercise-card';
import { SetsList } from '@/components/session/sets-list';
import { SetInput } from '@/components/session/set-input';
import { RestTimer } from '@/components/session/rest-timer';
import { SessionSummary } from '@/components/session/session-summary';

export interface SerializedLastPerformance {
  sessionStartedAt: string;
  sets: { weight: number; reps: number; rir: number | null }[];
  maxWeight: number;
  repsAtMaxWeight: number;
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
  };
  lastPerformances: Record<string, SerializedLastPerformance>;
  unit: WeightUnit;
};

type Mode =
  | { kind: 'input' }
  | { kind: 'rest'; endsAt: number; totalSec: number; nextExerciseIdx: number | null }
  | { kind: 'summary' };

export function SessionRunner({ session, lastPerformances, unit }: SessionRunnerProps) {
  const router = useRouter();
  const workout = session.workout!;
  const programExercises = workout.exercises;

  const [hydrated, setHydrated] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: 'input' });
  const [closing, setClosing] = useState(false);

  const currentPE = programExercises[currentIdx];

  // Hydrate IndexedDB with the server sets, then enable auto-sync.
  useEffect(() => {
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
      items.sort((a, b) =>
        a.exerciseId.localeCompare(b.exerciseId) || a.setNumber - b.setNumber,
      );
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
      notes: values.notes,
      isWarmup: values.isWarmup,
      isDropSet: values.isDropSet,
    });

    vibrate(VIBRATION_PATTERNS.validate);

    // Start the rest. If the set completes the goal and there is a next
    // exercise, prepare the auto-advance at the end of the timer.
    const isLastTargetSet =
      !values.isWarmup &&
      existing.filter((s) => !s.isWarmup).length + 1 >= currentPE.targetSets;
    const nextIdx =
      isLastTargetSet && currentIdx + 1 < programExercises.length ? currentIdx + 1 : null;

    setMode({
      kind: 'rest',
      endsAt: Date.now() + currentPE.restSec * 1000,
      totalSec: currentPE.restSec,
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
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not delete.');
        return;
      }
    }
    await db.pendingSets.delete(set.localId);
    toast.success('Set deleted.');
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
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not finish.');
        return;
      }
      toast.success('Session finished.');
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
  function goNext() {
    setCurrentIdx((i) => Math.min(programExercises.length - 1, i + 1));
    setMode({ kind: 'input' });
  }

  if (mode.kind === 'summary') {
    return (
      <SessionSummary
        session={session}
        sets={liveSets}
        programExercises={programExercises}
        unit={unit}
        onBack={() => setMode({ kind: 'input' })}
        onFinish={handleFinishSession}
        finishing={closing}
      />
    );
  }

  if (!currentPE) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-6">
        <p className="text-muted-foreground">No exercises in this session.</p>
      </main>
    );
  }

  const lastPerf = lastPerformances[currentPE.exerciseId];
  const currentSets = setsByExercise.get(currentPE.exerciseId) ?? [];

  return (
    <main className="flex flex-1 flex-col">
      {/* Sticky header with progress and exit button */}
      <div className="sticky top-[97px] z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{workout.name}</p>
            <p className="text-sm font-medium">
              Exercise {currentIdx + 1}/{programExercises.length} · {currentPE.exercise.name}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground"
            aria-label="Quit without finishing"
          >
            <Link href="/">
              <X className="size-4" />
            </Link>
          </Button>
        </div>
        <Progress value={progressPct} className="mt-2 h-1.5" />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4">
        <ExerciseCard programExercise={currentPE} lastPerformance={lastPerf} unit={unit} />

        <SetsList
          programExercise={currentPE}
          sets={currentSets}
          isInputActive={mode.kind === 'input'}
          onDeleteSet={handleDeleteSet}
        />

        {!hydrated ? null : mode.kind === 'input' ? (
          <SetInput
            programExercise={currentPE}
            existingSets={currentSets}
            lastPerformance={lastPerf}
            unit={unit}
            onSubmit={handleValidate}
          />
        ) : (
          <RestTimer
            endsAt={mode.endsAt}
            totalSec={mode.totalSec}
            nextLabel={
              mode.nextExerciseIdx != null
                ? programExercises[mode.nextExerciseIdx]?.exercise.name
                : null
            }
            onEnd={handleRestEnd}
            onSkip={handleSkipRest}
            onAdd30={handleAdd30s}
          />
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={currentIdx === 0 || mode.kind !== 'input'}
            className="min-h-tap"
          >
            <ChevronLeft className="size-4" />
            <span className="ml-1">Previous</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setMode({ kind: 'summary' })}
            className="min-h-tap"
          >
            <Flag className="size-4" />
            <span className="ml-2">Finish</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={
              currentIdx === programExercises.length - 1 || mode.kind !== 'input'
            }
            className="min-h-tap"
          >
            <span className="mr-1">Next</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
