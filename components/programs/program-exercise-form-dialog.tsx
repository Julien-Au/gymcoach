'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  programExerciseInputSchema,
  type ProgramExerciseInput,
} from '@/lib/schemas/program-exercise';
import { MUSCLE_GROUP_LABELS } from '@/lib/schemas/exercise';

interface CreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create';
  workoutId: string;
  catalog: Exercise[];
}

interface EditProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'edit';
  programExercise: ProgramExercise & { exercise: Exercise };
  catalog: Exercise[];
}

type Props = CreateProps | EditProps;

const DEFAULT_VALUES: ProgramExerciseInput = {
  exerciseId: '',
  targetSets: 4,
  targetRepsMin: 8,
  targetRepsMax: 10,
  targetRIR: 2,
  restSec: 90,
  tempo: '',
  notes: '',
};

export function ProgramExerciseFormDialog(props: Props) {
  const router = useRouter();

  const initial: ProgramExerciseInput = useMemo(() => {
    if (props.mode === 'edit') {
      const pe = props.programExercise;
      return {
        exerciseId: pe.exerciseId,
        targetSets: pe.targetSets,
        targetRepsMin: pe.targetRepsMin,
        targetRepsMax: pe.targetRepsMax,
        targetRIR: pe.targetRIR,
        restSec: pe.restSec,
        tempo: pe.tempo ?? '',
        notes: pe.notes ?? '',
      };
    }
    return DEFAULT_VALUES;
  }, [props]);

  const form = useForm<ProgramExerciseInput>({
    resolver: zodResolver(programExerciseInputSchema),
    defaultValues: initial,
  });

  useEffect(() => {
    if (props.open) form.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, initial]);

  // When an exercise is selected from the catalog, we pre-fill restSec
  // with its defaultRestSec (only in create mode).
  function handleExerciseChange(exerciseId: string) {
    form.setValue('exerciseId', exerciseId, { shouldValidate: true });
    if (props.mode === 'create') {
      const exo = props.catalog.find((e) => e.id === exerciseId);
      if (exo) form.setValue('restSec', exo.defaultRestSec);
    }
  }

  async function onSubmit(values: ProgramExerciseInput) {
    const url =
      props.mode === 'edit'
        ? `/api/program-exercises/${props.programExercise.id}`
        : `/api/workouts/${props.workoutId}/program-exercises`;
    const method = props.mode === 'edit' ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        tempo: values.tempo || null,
        notes: values.notes || null,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? 'Error');
      return;
    }
    toast.success(props.mode === 'edit' ? 'Exercise updated.' : 'Exercise added.');
    props.onOpenChange(false);
    router.refresh();
  }

  // Group the catalog by muscleGroup for the dropdown list.
  const grouped = useMemo(() => {
    const out = new Map<string, Exercise[]>();
    for (const ex of props.catalog) {
      const key = ex.muscleGroup;
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(ex);
    }
    return Array.from(out.entries());
  }, [props.catalog]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {props.mode === 'edit' ? 'Edit programmed exercise' : 'Add an exercise'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="exerciseId">Exercise</Label>
            <Select value={form.watch('exerciseId')} onValueChange={handleExerciseChange}>
              <SelectTrigger id="exerciseId">
                <SelectValue placeholder="Choose from the catalog" />
              </SelectTrigger>
              <SelectContent>
                {grouped.map(([group, list]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>
                      {MUSCLE_GROUP_LABELS[group as keyof typeof MUSCLE_GROUP_LABELS]}
                    </SelectLabel>
                    {list.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.exerciseId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.exerciseId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="targetSets">Sets</Label>
              <Input
                id="targetSets"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                {...form.register('targetSets')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetRIR">RIR</Label>
              <Input
                id="targetRIR"
                type="number"
                inputMode="numeric"
                min={0}
                max={5}
                {...form.register('targetRIR')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="targetRepsMin">Reps min</Label>
              <Input
                id="targetRepsMin"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                {...form.register('targetRepsMin')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetRepsMax">Reps max</Label>
              <Input
                id="targetRepsMax"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                {...form.register('targetRepsMax')}
              />
              {form.formState.errors.targetRepsMax && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.targetRepsMax.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="restSec">Rest (s)</Label>
              <Input
                id="restSec"
                type="number"
                inputMode="numeric"
                min={15}
                max={600}
                {...form.register('restSec')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempo">Tempo (optional)</Label>
              <Input id="tempo" placeholder="3-1-1-0" {...form.register('tempo')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" rows={2} {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => props.onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? 'Saving...'
                : props.mode === 'edit'
                  ? 'Save'
                  : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
