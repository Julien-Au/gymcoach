'use client';

import { useMemo, useState } from 'react';
import { Plus, Replace, Search, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type SessionProgramExercise = ProgramExercise & { exercise: Exercise };
type View = 'actions' | 'replace' | 'add' | 'removeConfirm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programExercise: SessionProgramExercise;
  programExercises: SessionProgramExercise[];
  catalog: Exercise[];
  loggedSetCount: number;
  onChanged: (options?: { selectProgramExerciseId?: string }) => void;
}

function replacementPayload(programExercise: ProgramExercise, exerciseId: string) {
  return {
    exerciseId,
    targetSets: programExercise.targetSets,
    targetRepsMin: programExercise.targetRepsMin,
    targetRepsMax: programExercise.targetRepsMax,
    targetRIR: programExercise.targetRIR,
    restSec: programExercise.restSec,
    autoregulationMode: programExercise.autoregulationMode,
    fatigueRate: programExercise.fatigueRate,
    loadAdjustmentPct: programExercise.loadAdjustmentPct,
    tempo: programExercise.tempo,
    notes: programExercise.notes,
    supersetGroup: programExercise.supersetGroup,
  };
}

export function SessionExerciseMenu({
  open,
  onOpenChange,
  programExercise,
  programExercises,
  catalog,
  loggedSetCount,
  onChanged,
}: Props) {
  const t = useTranslations('session.exerciseMenu');
  const exerciseName = useExerciseName();
  const [view, setView] = useState<View>('actions');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingReplacement, setPendingReplacement] = useState<Exercise | null>(null);

  const currentIndex = programExercises.findIndex((item) => item.id === programExercise.id);
  const previous = currentIndex > 0 ? programExercises[currentIndex - 1] : undefined;
  const next = currentIndex >= 0 ? programExercises[currentIndex + 1] : undefined;
  const existingExerciseIds = useMemo(
    () => new Set(programExercises.map((item) => item.exerciseId)),
    [programExercises],
  );

  const choices = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const source =
      view === 'add'
        ? catalog.filter((exercise) => !existingExerciseIds.has(exercise.id))
        : catalog.filter(
            (exercise) =>
              exercise.id !== programExercise.exerciseId &&
              !existingExerciseIds.has(exercise.id) &&
              exercise.muscleGroup === programExercise.exercise.muscleGroup,
          );
    if (!needle) return source;
    return source.filter(
      (exercise) =>
        exercise.name.toLocaleLowerCase().includes(needle) ||
        exerciseName(exercise.name).toLocaleLowerCase().includes(needle),
    );
  }, [
    catalog,
    exerciseName,
    existingExerciseIds,
    programExercise.exercise.muscleGroup,
    programExercise.exerciseId,
    query,
    view,
  ]);

  function close(nextOpen: boolean) {
    if (busy && !nextOpen) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setView('actions');
      setQuery('');
      setPendingReplacement(null);
    }
  }

  function openView(nextView: View) {
    setView(nextView);
    setQuery('');
    setPendingReplacement(null);
  }

  async function replaceExercise(exercise: Exercise) {
    setBusy(true);
    try {
      const response = await fetch(
        '/api/program-exercises/' + encodeURIComponent(programExercise.id),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(replacementPayload(programExercise, exercise.id)),
        },
      );
      if (!response.ok) throw new Error('replace failed');
      toast.success(t('replaced'));
      onOpenChange(false);
      setPendingReplacement(null);
      setQuery('');
      onChanged();
    } catch {
      toast.error(t('replaceError'));
    } finally {
      setBusy(false);
    }
  }

  function requestReplacement(exercise: Exercise) {
    if (loggedSetCount > 0) {
      setPendingReplacement(exercise);
      return;
    }
    void replaceExercise(exercise);
  }

  async function addExercise(exercise: Exercise) {
    setBusy(true);
    try {
      const response = await fetch(
        '/api/workouts/' + encodeURIComponent(programExercise.workoutId) + '/program-exercises',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exerciseId: exercise.id,
            targetSets: 4,
            targetRepsMin: 8,
            targetRepsMax: 12,
            targetRIR: 2,
            restSec: exercise.defaultRestSec,
          }),
        },
      );
      if (!response.ok) throw new Error('add failed');
      toast.success(t('added'));
      onOpenChange(false);
      setView('actions');
      setQuery('');
      onChanged();
    } catch {
      toast.error(t('addError'));
    } finally {
      setBusy(false);
    }
  }

  async function removeExercise() {
    setBusy(true);
    try {
      const response = await fetch(
        '/api/program-exercises/' + encodeURIComponent(programExercise.id),
        {
          method: 'DELETE',
        },
      );
      if (!response.ok) throw new Error('remove failed');
      toast.success(t('removed'));
      onOpenChange(false);
      setView('actions');
      setQuery('');
      onChanged({ selectProgramExerciseId: next?.id ?? previous?.id });
    } catch {
      toast.error(t('removeError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>
          {view === 'actions'
            ? t('actions')
            : view === 'replace'
              ? t('replace')
              : view === 'add'
                ? t('addExercises')
                : t('remove')}
        </DialogTitle>
        <DialogDescription>
          {view === 'actions'
            ? t('actionsDescription')
            : view === 'replace'
              ? t('replaceDescription')
              : view === 'add'
                ? t('addDescription')
                : t('removeDescription')}
        </DialogDescription>

        {view === 'actions' && (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => openView('replace')}
            >
              <Replace className="mr-2 size-4" aria-hidden />
              {t('replace')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => openView('add')}
            >
              <Plus className="mr-2 size-4" aria-hidden />
              {t('addExercises')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="justify-start"
              onClick={() => openView('removeConfirm')}
            >
              <Trash2 className="mr-2 size-4" aria-hidden />
              {t('remove')}
            </Button>
          </div>
        )}

        {view === 'removeConfirm' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {loggedSetCount > 0 ? t('removeLoggedWarning') : t('removeConfirm')}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setView('actions')}
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void removeExercise()}
              >
                {t('remove')}
              </Button>
            </div>
          </div>
        )}

        {(view === 'replace' || view === 'add') && pendingReplacement ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('replaceLoggedWarning')}</p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setPendingReplacement(null)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void replaceExercise(pendingReplacement)}
              >
                {t('confirmReplace', { name: exerciseName(pendingReplacement.name) })}
              </Button>
            </div>
          </div>
        ) : view === 'replace' || view === 'add' ? (
          <>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchExercises')}
                className="pl-9"
                aria-label={t('searchExercises')}
              />
            </div>
            <div className="flex flex-col gap-1">
              {choices.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t('noExercises')}</p>
              ) : (
                choices.map((exercise) => (
                  <Button
                    key={exercise.id}
                    type="button"
                    variant="ghost"
                    className="justify-start"
                    disabled={busy}
                    onClick={() =>
                      view === 'replace' ? requestReplacement(exercise) : void addExercise(exercise)
                    }
                  >
                    {exerciseName(exercise.name)}
                  </Button>
                ))
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setView('actions')}
            >
              {t('back')}
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
