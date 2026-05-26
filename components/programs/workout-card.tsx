'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Plus, Pencil, Trash2 } from 'lucide-react';
import type { Exercise, ProgramExercise, Workout } from '@prisma/client';
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
import { DAY_LABELS } from '@/lib/schemas/workout';

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };
type WorkoutWithExercises = Workout & { exercises: ProgramExerciseWithExercise[] };

interface Props {
  workout: WorkoutWithExercises;
  catalog: Exercise[];
}

export function WorkoutCard({ workout, catalog }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [addExoOpen, setAddExoOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Supprimer la séance "${workout.name}" et tous ses exercices ?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workouts/${workout.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Suppression impossible.');
        return;
      }
      toast.success('Séance supprimée.');
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const dayLabel =
    workout.dayOfWeek != null ? DAY_LABELS[workout.dayOfWeek - 1] ?? null : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{workout.name}</CardTitle>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {dayLabel && <Badge variant="secondary">{dayLabel}</Badge>}
              <span>
                {workout.exercises.length} exercice{workout.exercises.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-tap min-w-tap"
                aria-label="Actions séance"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="mr-2 size-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleDelete}
                disabled={deleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 pt-0">
        {workout.exercises.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun exercice programmé. Utilise le bouton ci-dessous pour en ajouter.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {workout.exercises.map((pe) => (
              <li key={pe.id}>
                <ProgramExerciseRow programExercise={pe} catalog={catalog} />
              </li>
            ))}
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
          <span className="ml-2">Ajouter un exercice</span>
        </Button>
        {catalog.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Le catalogue est vide. Ajoute d&apos;abord un exercice dans Catalogue.
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
