'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Workout } from '@prisma/client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DAY_LABELS, workoutInputSchema, type WorkoutInput } from '@/lib/schemas/workout';

interface CreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create';
  programId: string;
}
interface EditProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'edit';
  workout: Workout;
}
type Props = CreateProps | EditProps;

const NO_DAY = '__none__';

export function WorkoutFormDialog(props: Props) {
  const router = useRouter();

  const initial: WorkoutInput =
    props.mode === 'edit'
      ? { name: props.workout.name, dayOfWeek: props.workout.dayOfWeek }
      : { name: '', dayOfWeek: null };

  const form = useForm<WorkoutInput>({
    resolver: zodResolver(workoutInputSchema),
    defaultValues: initial,
  });

  useEffect(() => {
    if (props.open) {
      form.reset(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  async function onSubmit(values: WorkoutInput) {
    const url =
      props.mode === 'edit'
        ? `/api/workouts/${props.workout.id}`
        : `/api/programs/${props.programId}/workouts`;
    const method = props.mode === 'edit' ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: values.name, dayOfWeek: values.dayOfWeek ?? null }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? 'Erreur');
      return;
    }
    toast.success(props.mode === 'edit' ? 'Séance modifiée.' : 'Séance créée.');
    props.onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === 'edit' ? 'Modifier la séance' : 'Nouvelle séance'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" placeholder="ex. Upper - Haut du corps" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Jour (optionnel)</Label>
            <Select
              value={form.watch('dayOfWeek') == null ? NO_DAY : String(form.watch('dayOfWeek'))}
              onValueChange={(v) =>
                form.setValue('dayOfWeek', v === NO_DAY ? null : Number(v))
              }
            >
              <SelectTrigger id="dayOfWeek">
                <SelectValue placeholder="Flexible" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DAY}>Flexible</SelectItem>
                {DAY_LABELS.map((label, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => props.onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? 'Enregistrement...'
                : props.mode === 'edit'
                  ? 'Enregistrer'
                  : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
