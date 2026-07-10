'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Plus, Pencil, Trash2 } from 'lucide-react';
import type { Exercise, ProgramExercise, Workout } from '@/lib/prisma-client';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProgramExerciseRow } from '@/components/programs/program-exercise-row';
import { WorkoutFormDialog } from '@/components/programs/workout-form-dialog';
import { ProgramExerciseFormDialog } from '@/components/programs/program-exercise-form-dialog';
import { buildSupersetView, smallestFreeGroup } from '@/lib/supersets';

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };
type WorkoutWithExercises = Workout & { exercises: ProgramExerciseWithExercise[] };

interface Props {
  workout: WorkoutWithExercises;
  catalog: Exercise[];
}

export function WorkoutCard({ workout, catalog }: Props) {
  const t = useTranslations('programs.workout');
  const exerciseT = useTranslations('programs.exercise');
  const common = useTranslations('common');
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [addExoOpen, setAddExoOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(t('deleteConfirm', { name: workout.name }))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workouts/${workout.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(t('deleteError'));
        return;
      }
      toast.success(t('deleted'));
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const dayKey = workout.dayOfWeek != null ? DAY_KEYS[workout.dayOfWeek - 1] : null;
  const dayLabel = dayKey ? common(`days.${dayKey}`) : null;

  // Superset pairing (issue #146, slice 1): rows render in presentation order
  // (group members together) with A1/A2 labels derived on read.
  const supersetView = buildSupersetView(workout.exercises);

  async function updateSupersetGroup(
    pe: ProgramExerciseWithExercise,
    supersetGroup: number | null,
  ): Promise<boolean> {
    const res = await fetch(`/api/program-exercises/${pe.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exerciseId: pe.exerciseId,
        targetSets: pe.targetSets,
        targetRepsMin: pe.targetRepsMin,
        targetRepsMax: pe.targetRepsMax,
        targetRIR: pe.targetRIR,
        restSec: pe.restSec,
        tempo: pe.tempo,
        notes: pe.notes,
        supersetGroup,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? t('supersetUpdateError'));
      return false;
    }
    return true;
  }

  // Pairs a row with the one above it (in presentation order): joins the
  // previous row's group, creating a fresh group for both when the previous
  // row is standalone.
  async function handlePairWithPrevious(index: number) {
    const pe = supersetView.ordered[index];
    const previous = supersetView.ordered[index - 1];
    if (!pe || !previous) return;
    let group = previous.supersetGroup;
    if (group == null) {
      group = smallestFreeGroup(workout.exercises);
      if (group == null) {
        toast.error(t('supersetLimit'));
        return;
      }
      if (!(await updateSupersetGroup(previous, group))) return;
    }
    if (!(await updateSupersetGroup(pe, group))) return;
    toast.success(t('supersetPaired'));
    router.refresh();
  }

  async function handleUnpair(pe: ProgramExerciseWithExercise) {
    if (!(await updateSupersetGroup(pe, null))) return;
    toast.success(t('supersetRemoved'));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{workout.name}</CardTitle>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {dayLabel && <Badge variant="secondary">{dayLabel}</Badge>}
              <span>
                {common('counts.exercises', { count: workout.exercises.length })}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-tap min-w-tap"
                aria-label={t('actions')}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="mr-2 size-4" />
                {common('actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleDelete}
                disabled={deleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                {common('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 pt-0">
        {workout.exercises.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {supersetView.ordered.map((pe, index) => {
              const previous = supersetView.ordered[index - 1];
              const alreadyPairedWithPrevious =
                pe.supersetGroup != null &&
                previous != null &&
                previous.supersetGroup === pe.supersetGroup;
              return (
                <li key={pe.id}>
                  <ProgramExerciseRow
                    programExercise={pe}
                    catalog={catalog}
                    supersetLabel={supersetView.labels.get(pe.id) ?? null}
                    onPairWithPrevious={
                      index > 0 && !alreadyPairedWithPrevious
                        ? () => handlePairWithPrevious(index)
                        : null
                    }
                    onUnpair={pe.supersetGroup != null ? () => handleUnpair(pe) : null}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddExoOpen(true)}
          className="min-h-tap self-start"
          disabled={catalog.length === 0}
        >
          <Plus className="size-4" />
          <span className="ml-2">{exerciseT('add')}</span>
        </Button>
        {catalog.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {t('catalogEmpty')}
          </p>
        )}
      </CardContent>

      <WorkoutFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        workout={workout}
      />
      <ProgramExerciseFormDialog
        open={addExoOpen}
        onOpenChange={setAddExoOpen}
        mode="create"
        workoutId={workout.id}
        catalog={catalog}
      />
    </Card>
  );
}
