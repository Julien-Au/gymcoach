'use client';

import { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import type { Exercise, ProgramExercise, WeightUnit } from '@prisma/client';
import {
  displayIncrement,
  fromDisplayWeight,
  roundWeight,
  toDisplayWeight,
  unitLabel,
} from '@/lib/units';
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
  unit: WeightUnit;
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

export function SetInput({ programExercise, existingSets, lastPerformance, unit, onSubmit }: Props) {
  // Pre-fill: last set of this exercise in the current session,
  // otherwise the last performance, otherwise defaults.
  const initial = computeInitial(programExercise, existingSets, lastPerformance);
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);

  // Re-init when the exercise changes or a set changes.
  useEffect(() => {
    setForm(computeInitial(programExercise, existingSets, lastPerformance));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programExercise.id, existingSets.length]);

  const incrementKg = weightIncrement(programExercise.exercise.category);
  // Increment shown in the user's unit (clean plate jumps), applied to the
  // kg-stored weight. The form value stays in kg; only display/input convert.
  const stepDisplay = displayIncrement(incrementKg, unit);
  const stepKg = fromDisplayWeight(stepDisplay, unit);
  // Show the kg-stored weight in the user's unit. KG renders the raw value
  // (unchanged behavior); LB shows a rounded conversion.
  const displayWeight =
    unit === 'LB' ? roundWeight(toDisplayWeight(form.weight, unit), 1) : form.weight;

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
      // The transition animation to the rest timer is handled by the parent.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {/* Load */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Load ({unitLabel(unit)})
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustWeight(-stepKg)}
              className="min-h-tap min-w-tap"
              aria-label={`-${stepDisplay} ${unitLabel(unit)}`}
            >
              <Minus className="size-5" />
            </Button>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={displayWeight}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  weight: fromDisplayWeight(parseFloat(e.target.value) || 0, unit),
                }))
              }
              className="h-14 text-center text-2xl font-semibold"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustWeight(stepKg)}
              className="min-h-tap min-w-tap"
              aria-label={`+${stepDisplay} ${unitLabel(unit)}`}
            >
              <Plus className="size-5" />
            </Button>
          </div>
        </div>

        {/* Reps */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Reps
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
            <span>Warmup</span>
          </label>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="set-notes" className="text-xs uppercase tracking-wide text-muted-foreground">
            Quick note (optional)
          </Label>
          <Textarea
            id="set-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="e.g. wrist pain, dropped the weight mid-set, felt easy, etc."
          />
        </div>

        <Button
          type="button"
          onClick={handleValidate}
          disabled={submitting}
          className="h-20 w-full text-lg font-semibold"
        >
          <Check className="size-6" />
          <span className="ml-2">{submitting ? 'Saving...' : 'Log the set'}</span>
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
  // 1. If a set already exists for this exercise in the current session,
  //    reuse its values (idea: you aim for the same load, adjust the reps).
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
  // 2. Otherwise, pre-fill with the suggestion (double progression algo). If
  //    progressing, aim for the bottom of the rep range with the heavier
  //    load; otherwise try to beat the previous reps (at least match them).
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
  // 3. Defaults: middle of the rep range, target RIR, load 0.
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
