'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Exercise } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CATEGORY_LABELS,
  MUSCLE_GROUP_LABELS,
  exerciseCategoryValues,
  exerciseInputSchema,
  muscleGroupValues,
  type ExerciseInput,
} from '@/lib/schemas/exercise';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  exercise?: Exercise;
}

const DEFAULT_VALUES: ExerciseInput = {
  name: '',
  muscleGroup: 'CHEST',
  category: 'COMPOUND',
  defaultRestSec: 90,
  notes: '',
  usesBodyweight: false,
};

export function ExerciseFormDialog({ open, onOpenChange, mode, exercise }: Props) {
  const router = useRouter();
  const form = useForm<ExerciseInput>({
    resolver: zodResolver(exerciseInputSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && exercise) {
        form.reset({
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          category: exercise.category,
          defaultRestSec: exercise.defaultRestSec,
          notes: exercise.notes ?? '',
          usesBodyweight: exercise.usesBodyweight,
        });
      } else {
        form.reset(DEFAULT_VALUES);
      }
    }
  }, [open, mode, exercise, form]);

  async function onSubmit(values: ExerciseInput) {
    const url =
      mode === 'edit' && exercise ? `/api/exercises/${exercise.id}` : '/api/exercises';
    const method = mode === 'edit' ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, notes: values.notes || null }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? 'Erreur');
      return;
    }
    toast.success(mode === 'edit' ? 'Exercice modifié.' : 'Exercice créé.');
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Modifier l\'exercice' : 'Ajouter un exercice'}
          </DialogTitle>
          <DialogDescription>
            Renseigne le nom, le groupe musculaire et la catégorie.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="muscleGroup">Groupe musculaire</Label>
              <Select
                value={form.watch('muscleGroup')}
                onValueChange={(v) => form.setValue('muscleGroup', v as ExerciseInput['muscleGroup'])}
              >
                <SelectTrigger id="muscleGroup">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {muscleGroupValues.map((g) => (
                    <SelectItem key={g} value={g}>
                      {MUSCLE_GROUP_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Catégorie</Label>
              <Select
                value={form.watch('category')}
                onValueChange={(v) => form.setValue('category', v as ExerciseInput['category'])}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exerciseCategoryValues.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultRestSec">Repos par défaut (secondes)</Label>
            <Input
              id="defaultRestSec"
              type="number"
              inputMode="numeric"
              min={15}
              max={600}
              {...form.register('defaultRestSec')}
            />
            {form.formState.errors.defaultRestSec && (
              <p className="text-sm text-destructive">
                {form.formState.errors.defaultRestSec.message}
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-start justify-between gap-3 rounded-md border border-border/40 p-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">Exercice au poids du corps</p>
              <p className="text-xs text-muted-foreground">
                Tractions, dips, pompes... Le tonnage effectif inclut ton poids
                du corps. La charge saisie représente le lest ajouté (négatif si
                machine d&apos;assistance).
              </p>
            </div>
            <Switch
              checked={form.watch('usesBodyweight')}
              onCheckedChange={(v) => form.setValue('usesBodyweight', v)}
            />
          </label>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes / consignes (optionnel)</Label>
            <Textarea id="notes" rows={3} {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? 'Enregistrement...'
                : mode === 'edit'
                  ? 'Enregistrer'
                  : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
