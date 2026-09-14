'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type SessionProgramExercise = ProgramExercise & { exercise: Exercise };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programExercise: SessionProgramExercise;
  catalog: Exercise[];
  loggedSetCount: number;
  onChanged: () => void;
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
  catalog,
  loggedSetCount,
  onChanged,
}: Props) {
  const t = useTranslations('session.exerciseMenu');
  const exerciseName = useExerciseName();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingReplacement, setPendingReplacement] = useState<Exercise | null>(null);

  const replacements = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return catalog.filter((exercise) => {
      if (exercise.id === programExercise.exerciseId) return false;
      if (exercise.muscleGroup !== programExercise.exercise.muscleGroup) return false;
      if (!needle) return true;
      return (
        exercise.name.toLocaleLowerCase().includes(needle) ||
        exerciseName(exercise.name).toLocaleLowerCase().includes(needle)
      );
    });
  }, [catalog, exerciseName, programExercise.exercise.muscleGroup, programExercise.exerciseId, query]);

  function close(nextOpen: boolean) {
    if (busy && !nextOpen) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setQuery('');
      setPendingReplacement(null);
    }
  }

  async function replaceExercise(exercise: Exercise) {
    setBusy(true);
    try {
      const response = await fetch('/api/program-exercises/' + encodeURIComponent(programExercise.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replacementPayload(programExercise, exercise.id)),
      });
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

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{t('replace')}</DialogTitle>
        <DialogDescription>{t('replaceDescription')}</DialogDescription>

        {pendingReplacement ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('replaceLoggedWarning')}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setPendingReplacement(null)}>
                {t('cancel')}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void replaceExercise(pendingReplacement)}>
                {t('confirmReplace', { name: exerciseName(pendingReplacement.name) })}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchExercises')}
                className="pl-9"
                aria-label={t('searchExercises')}
              />
            </div>
            <div className="flex flex-col gap-1">
              {replacements.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t('noExercises')}</p>
              ) : (
                replacements.map((exercise) => (
                  <Button
                    key={exercise.id}
                    type="button"
                    variant="ghost"
                    className="justify-start"
                    disabled={busy}
                    onClick={() => requestReplacement(exercise)}
                  >
                    {exerciseName(exercise.name)}
                  </Button>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
