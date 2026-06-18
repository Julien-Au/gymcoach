'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus } from 'lucide-react';
import type { Exercise, Program, ProgramExercise, Workout } from '@/lib/prisma-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProgramEditDialog } from '@/components/programs/program-edit-dialog';
import { ProgramDeleteButton } from '@/components/programs/program-delete-button';
import { WorkoutCard } from '@/components/programs/workout-card';
import { WorkoutFormDialog } from '@/components/programs/workout-form-dialog';

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };
type WorkoutWithExercises = Workout & { exercises: ProgramExerciseWithExercise[] };
export type ProgramFull = Program & { workouts: WorkoutWithExercises[] };

interface Props {
  program: ProgramFull;
  catalog: Exercise[];
}

export function ProgramDetailView({ program, catalog }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  async function toggleActive() {
    setActivating(true);
    try {
      const res = await fetch(`/api/programs/${program.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !program.isActive }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Error');
        return;
      }
      toast.success(program.isActive ? 'Program deactivated.' : 'Program activated.');
      router.refresh();
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/programs">
          <ChevronLeft className="size-4" />
          <span className="ml-1">Back</span>
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl">{program.name}</CardTitle>
              <CardDescription>{program.phase}</CardDescription>
            </div>
            {program.isActive && <Badge>Active</Badge>}
          </div>
        </CardHeader>
        {program.description && (
          <CardContent className="text-sm text-muted-foreground">{program.description}</CardContent>
        )}
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <Button
            variant={program.isActive ? 'outline' : 'default'}
            size="sm"
            onClick={toggleActive}
            disabled={activating}
            className="min-h-tap"
          >
            {program.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="min-h-tap"
          >
            Edit
          </Button>
          <ProgramDeleteButton programId={program.id} programName={program.name} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Sessions</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddWorkoutOpen(true)}
          className="min-h-tap"
        >
          <Plus className="size-4" />
          <span className="ml-2">Add a session</span>
        </Button>
      </div>

      {program.workouts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sessions</CardTitle>
            <CardDescription>
              Add a first session to structure this program (e.g. Upper, Lower).
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {program.workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} catalog={catalog} />
          ))}
        </div>
      )}

      <ProgramEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        program={program}
      />
      <WorkoutFormDialog
        open={addWorkoutOpen}
        onOpenChange={setAddWorkoutOpen}
        mode="create"
        programId={program.id}
      />
    </div>
  );
}
