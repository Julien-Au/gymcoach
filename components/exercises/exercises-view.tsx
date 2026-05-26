'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import type { Exercise, MuscleGroup } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ExerciseFormDialog } from '@/components/exercises/exercise-form-dialog';
import { DeleteExerciseButton } from '@/components/exercises/delete-exercise-button';
import { CATEGORY_LABELS, MUSCLE_GROUP_LABELS } from '@/lib/schemas/exercise';

interface ExercisesViewProps {
  exercises: Exercise[];
}

export function ExercisesView({ exercises }: ExercisesViewProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);

  const grouped = useMemo(() => groupByMuscle(exercises), [exercises]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catalogue d&apos;exercices</h1>
          <p className="text-sm text-muted-foreground">
            {exercises.length} exercice{exercises.length > 1 ? 's' : ''} enregistré
            {exercises.length > 1 ? 's' : ''}.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="min-h-tap">
          <Plus className="size-4" />
          <span className="ml-2">Ajouter</span>
        </Button>
      </div>

      {exercises.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucun exercice</CardTitle>
            <CardDescription>
              Le catalogue est vide. Ajoute ton premier exercice pour pouvoir l&apos;utiliser dans
              un programme.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([group, list]) => (
            <section key={group} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {MUSCLE_GROUP_LABELS[group as MuscleGroup]}
              </h2>
              <div className="flex flex-col gap-2">
                {list.map((ex) => (
                  <ExerciseRow key={ex.id} exercise={ex} onEdit={() => setEditing(ex)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ExerciseFormDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" />
      <ExerciseFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        mode="edit"
        exercise={editing ?? undefined}
      />
    </div>
  );
}

function ExerciseRow({ exercise, onEdit }: { exercise: Exercise; onEdit: () => void }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{exercise.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary">{CATEGORY_LABELS[exercise.category]}</Badge>
            <span>repos {exercise.defaultRestSec}s</span>
          </div>
          {exercise.notes && (
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{exercise.notes}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label="Modifier"
            className="min-h-tap min-w-tap"
          >
            <Pencil className="size-4" />
          </Button>
          <DeleteExerciseButton exerciseId={exercise.id} exerciseName={exercise.name} />
        </div>
      </CardContent>
    </Card>
  );
}

function groupByMuscle(exercises: Exercise[]): Record<string, Exercise[]> {
  const out: Record<string, Exercise[]> = {};
  for (const ex of exercises) {
    if (!out[ex.muscleGroup]) out[ex.muscleGroup] = [];
    out[ex.muscleGroup]!.push(ex);
  }
  return out;
}
