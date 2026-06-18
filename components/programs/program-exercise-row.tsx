'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, MoreHorizontal, Pencil, Trash2, Unlink } from 'lucide-react';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProgramExerciseFormDialog } from '@/components/programs/program-exercise-form-dialog';
import { CATEGORY_LABELS, MUSCLE_GROUP_LABELS } from '@/lib/schemas/exercise';

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };

interface Props {
  programExercise: ProgramExerciseWithExercise;
  catalog: Exercise[];
  // Superset pairing (issue #146, slice 1). The label ("A1") is derived by the
  // parent from group membership and order; the actions are null when not
  // applicable (first row cannot pair up, a standalone row cannot unpair).
  supersetLabel?: string | null;
  onPairWithPrevious?: (() => void) | null;
  onUnpair?: (() => void) | null;
}

export function ProgramExerciseRow({
  programExercise,
  catalog,
  supersetLabel = null,
  onPairWithPrevious = null,
  onUnpair = null,
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Remove "${programExercise.exercise.name}" from this session?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/program-exercises/${programExercise.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not delete.');
        return;
      }
      toast.success('Exercise removed.');
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const repsLabel =
    programExercise.targetRepsMin === programExercise.targetRepsMax
      ? `${programExercise.targetRepsMin}`
      : `${programExercise.targetRepsMin}-${programExercise.targetRepsMax}`;

  return (
    <>
      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{programExercise.exercise.name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {supersetLabel && <Badge>Superset {supersetLabel}</Badge>}
              <Badge variant="secondary">
                {MUSCLE_GROUP_LABELS[programExercise.exercise.muscleGroup]}
              </Badge>
              <Badge variant="outline">
                {CATEGORY_LABELS[programExercise.exercise.category]}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {programExercise.targetSets} sets × {repsLabel} reps · RIR{' '}
              {programExercise.targetRIR} · rest {programExercise.restSec}s
              {programExercise.tempo && ` · tempo ${programExercise.tempo}`}
            </p>
            {programExercise.notes && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {programExercise.notes}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-tap min-w-tap"
                aria-label="Exercise actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              {onPairWithPrevious && (
                <DropdownMenuItem onSelect={() => onPairWithPrevious()}>
                  <Link2 className="mr-2 size-4" />
                  Pair with previous
                </DropdownMenuItem>
              )}
              {onUnpair && (
                <DropdownMenuItem onSelect={() => onUnpair()}>
                  <Unlink className="mr-2 size-4" />
                  Unpair superset
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleDelete}
                disabled={deleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ProgramExerciseFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        programExercise={programExercise}
        catalog={catalog}
      />
    </>
  );
}
