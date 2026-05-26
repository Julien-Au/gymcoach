'use client';

import { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import type { Exercise, ProgramExercise } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { suggestNextWeight, weightIncrement } from '@/lib/progression';
import type { PendingSet } from '@/lib/indexeddb';
import type { SerializedLastPerformance } from './session-runner';

interface Props {
  programExercise: ProgramExercise & { exercise: Exercise };
  existingSets: PendingSet[];
  lastPerformance: SerializedLastPerformance | undefined;
  onSubmit: (values: {
    weight: number;
    reps: number;
    rir: number | null;
    isWarmup: boolean;
    isDropSet: boolean;
    notes: string | null;
  }) => Promise<void>;
}

interface FormState {
  weight: number;
  reps: number;
  rir: number | null;
  isWarmup: boolean;
  isDropSet: boolean;
  notes: string;
}

const RIR_OPTIONS = [0, 1, 2, 3];

export function SetInput({ programExercise, existingSets, lastPerformance, onSubmit }: Props) {
  // Pré-remplissage : dernière série de cet exo dans la session courante,
  // sinon dernière performance, sinon defaults.
  const initial = computeInitial(programExercise, existingSets, lastPerformance);
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);

  // Re-init quand on change d'exercice ou qu'une série change.
  useEffect(() => {
    setForm(computeInitial(programExercise, existingSets, lastPerformance));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programExercise.id, existingSets.length]);

  const incrementKg = weightIncrement(programExercise.exercise.category);

  function adjustWeight(delta: number) {
    setForm((f) => ({ ...f, weight: Math.max(0, +(f.weight + delta).toFixed(2)) }));
  }
  function adjustReps(delta: number) {
    setForm((f) => ({ ...f, reps: Math.max(0, f.reps + delta) }));
  }

  async function handleValidate() {
    setSubmitting(true);
    try {
      await onSubmit({
        weight: form.weight,
        reps: form.reps,
        rir: form.rir,
        isWarmup: form.isWarmup,
        isDropSet: form.isDropSet,
        notes: form.notes.trim() || null,
      });
      // L'animation de transition vers le rest timer est gérée par le parent.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {/* Charge */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Charge (kg)
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustWeight(-incrementKg)}
              className="min-h-tap min-w-tap"
              aria-label={`-${incrementKg} kg`}
            >
              <Minus className="size-5" />
            </Button>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={form.weight}
              onChange={(e) =>
                setForm((f) => ({ ...f, weight: parseFloat(e.target.value) || 0 }))
              }
              className="h-14 text-center text-2xl font-semibold"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustWeight(incrementKg)}
              className="min-h-tap min-w-tap"
              aria-label={`+${incrementKg} kg`}
            >
              <Plus className="size-5" />
            </Button>
          </div>
        </div>

        {/* Reps */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Répétitions
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustReps(-1)}
              className="min-h-tap min-w-tap"
              aria-label="-1 rep"
            >
              <Minus className="size-5" />
            </Button>
            <Input
              type="number"
              inputMode="numeric"
              value={form.reps}
              onChange={(e) =>
                setForm((f) => ({ ...f, reps: parseInt(e.target.value, 10) || 0 }))
              }
              className="h-14 text-center text-2xl font-semibold"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustReps(1)}
              className="min-h-tap min-w-tap"
              aria-label="+1 rep"
            >
              <Plus className="size-5" />
            </Button>
          </div>
        </div>

        {/* RIR */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            RIR (reps in reserve)
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {RIR_OPTIONS.map((opt) => (
              <Button
                key={opt}
                type="button"
                variant={form.rir === opt ? 'default' : 'outline'}
                onClick={() => setForm((f) => ({ ...f, rir: opt }))}
                className="min-h-tap text-lg font-semibold"
              >
                {opt}
              </Button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Switch
              checked={form.isDropSet}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isDropSet: v }))}
            />
            <span>Drop set</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Switch
              checked={form.isWarmup}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isWarmup: v }))}
            />
            <span>Échauffement</span>
          </label>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="set-notes" className="text-xs uppercase tracking-wide text-muted-foreground">
            Note rapide (optionnel)
          </Label>
          <Textarea
            id="set-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="ex. douleur poignet, drop set 22.5 puis 18kg, etc."
          />
        </div>

        <Button
          type="button"
          onClick={handleValidate}
          disabled={submitting}
          className="h-20 w-full text-lg font-semibold"
        >
          <Check className="size-6" />
          <span className="ml-2">{submitting ? 'Enregistrement...' : 'Valider la série'}</span>
        </Button>
      </CardContent>
    </Card>
  );
}

function computeInitial(
  pe: ProgramExercise & { exercise: Exercise },
  existingSets: PendingSet[],
  lastPerf: SerializedLastPerformance | undefined,
): FormState {
  // 1. Si une série existe déjà sur cet exo dans la session courante,
  //    reprendre ses valeurs (idée : tu vises la même charge, ajustes les reps).
  const lastInSession = existingSets.filter((s) => !s.isWarmup).at(-1);
  if (lastInSession) {
    return {
      weight: lastInSession.weight,
      reps: lastInSession.reps,
      rir: lastInSession.rir,
      isWarmup: false,
      isDropSet: false,
      notes: '',
    };
  }
  // 2. Sinon, pré-remplir avec la suggestion (algo double progression). Si on
  //    progresse, on vise le bas de la fourchette de reps avec la charge plus
  //    lourde ; sinon on essaie de battre les reps précédents (au moins matcher).
  if (lastPerf) {
    const suggestion = suggestNextWeight(pe, lastPerf.sets);
    const initialReps =
      suggestion.reason === 'progression'
        ? pe.targetRepsMin
        : lastPerf.repsAtMaxWeight;
    return {
      weight: suggestion.weight ?? lastPerf.maxWeight,
      reps: initialReps,
      rir: pe.targetRIR,
      isWarmup: false,
      isDropSet: false,
      notes: '',
    };
  }
  // 3. Defaults : milieu de la fourchette de reps, RIR cible, charge 0.
  const midReps = Math.round((pe.targetRepsMin + pe.targetRepsMax) / 2);
  return {
    weight: 0,
    reps: midReps,
    rir: pe.targetRIR,
    isWarmup: false,
    isDropSet: false,
    notes: '',
  };
}
