'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Search } from 'lucide-react';
import type { Exercise, MuscleGroup } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExerciseFormDialog } from '@/components/exercises/exercise-form-dialog';
import { DeleteExerciseButton } from '@/components/exercises/delete-exercise-button';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import {
  equipmentTypeMessageKeys,
  exerciseCategoryMessageKeys,
  muscleGroupMessageKeys,
} from '@/i18n/enum-keys';

interface ExercisesViewProps {
  exercises: Exercise[];
}

export function ExercisesView({ exercises }: ExercisesViewProps) {
  const t = useTranslations('exercises');
  const common = useTranslations('common');
  const exerciseName = useExerciseName();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [query, setQuery] = useState('');

  // Case-insensitive substring match on the exercise name. The query only
  // narrows the already-loaded list (no API call); an empty query shows
  // everything, preserving the original behaviour.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (ex) => ex.name.toLowerCase().includes(q) || exerciseName(ex.name).toLowerCase().includes(q),
    );
  }, [exerciseName, exercises, query]);

  const grouped = useMemo(() => groupByMuscle(filtered), [filtered]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('savedCount', { count: exercises.length })}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="min-h-tap">
          <Plus className="size-4" />
          <span className="ml-2">{common('actions.add')}</span>
        </Button>
      </div>

      {exercises.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="pl-9"
          />
        </div>
      )}

      {exercises.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('emptyTitle')}</CardTitle>
            <CardDescription>{t('emptyDescription')}</CardDescription>
          </CardHeader>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('noMatchTitle')}</CardTitle>
            <CardDescription>{t('noMatchDescription', { query: query.trim() })}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([group, list]) => (
            <section key={group} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`muscleGroups.${muscleGroupMessageKeys[group as MuscleGroup]}`)}
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
  const t = useTranslations('exercises');
  const exerciseName = useExerciseName();
  const displayName = exerciseName(exercise.name);

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary">
              {t(`categories.${exerciseCategoryMessageKeys[exercise.category]}`)}
            </Badge>
            <Badge variant="outline">
              {t(`equipmentTypes.${equipmentTypeMessageKeys[exercise.equipmentType]}`)}
            </Badge>
            <span>{t('restSeconds', { seconds: exercise.defaultRestSec })}</span>
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
            aria-label={t('editTitle')}
            className="min-h-tap min-w-tap"
          >
            <Pencil className="size-4" />
          </Button>
          <DeleteExerciseButton exerciseId={exercise.id} exerciseName={displayName} />
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
