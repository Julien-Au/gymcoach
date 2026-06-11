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
import { suggestNextWeight, weightIncrement, type ReadinessSignal } from '@/lib/progression';
import { formatDuration, MAX_DISTANCE_M, parseDurationToSec } from '@/lib/cardio';
import { parseSetShorthand, rpeToRir } from '@/lib/set-shorthand';
import { PlateCalculator } from '@/components/session/plate-calculator';
import { WarmupCalculator } from '@/components/session/warmup-calculator';
import type { PendingSet } from '@/lib/indexeddb';
import type { SerializedLastPerformance } from './session-runner';

interface Props {
  programExercise: ProgramExercise & { exercise: Exercise };
  existingSets: PendingSet[];
  lastPerformance: SerializedLastPerformance | undefined;
  readiness: ReadinessSignal | null;
  // True while a planned deload week is active (issue #112).
  deloadActive: boolean;
  unit: WeightUnit;
  onSubmit: (values: {
    weight: number;
    reps: number;
    rir: number | null;
    durationSec: number | null;
    distanceM: number | null;
    isWarmup: boolean;
    isDropSet: boolean;
    notes: string | null;
  }) => Promise<void>;
}

interface FormState {
  weight: number;
  reps: number;
  rir: number | null;
  // Cardio inputs (issue #133), kept as raw strings while typing: duration as
  // "mm:ss" (or plain minutes) and distance in km. Empty on strength exercises.
  durationInput: string;
  distanceInput: string;
  isWarmup: boolean;
  isDropSet: boolean;
  notes: string;
}

const RIR_OPTIONS = [0, 1, 2, 3];

export function SetInput({
  programExercise,
  existingSets,
  lastPerformance,
  readiness,
  deloadActive,
  unit,
  onSubmit,
}: Props) {
  // Pre-fill: last set of this exercise in the current session,
  // otherwise the last performance, otherwise defaults.
  const initial = computeInitial(
    programExercise,
    existingSets,
    lastPerformance,
    readiness,
    deloadActive,
  );
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [quickEntry, setQuickEntry] = useState('');

  // Re-init when the exercise changes or a set changes.
  useEffect(() => {
    setForm(
      computeInitial(programExercise, existingSets, lastPerformance, readiness, deloadActive),
    );
    setQuickEntry('');
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

  // Quick entry: parse shorthand like "100x8@9" and fill the classic fields.
  // The user still confirms with the log button; the classic fields keep
  // working unchanged.
  function handleQuickEntry(value: string) {
    setQuickEntry(value);
    const parsed = parseSetShorthand(value);
    if (!parsed) return;
    setForm((f) => ({
      ...f,
      // The shorthand weight is typed in the user's display unit, exactly
      // like the classic weight field.
      weight: fromDisplayWeight(parsed.weight, unit),
      reps: parsed.reps,
      rir: parsed.rpe !== undefined ? rpeToRir(parsed.rpe) : f.rir,
    }));
  }

  const quickEntryInvalid = quickEntry.trim() !== '' && parseSetShorthand(quickEntry) === null;

  // Cardio mode (issue #133): the logger swaps weight/reps for duration and
  // optional distance. The set is stored with weight = 0 / reps = 1 (the API
  // normalizes them too) and the UI never shows those fields for CARDIO.
  const isCardio = programExercise.exercise.category === 'CARDIO';
  const durationSec = parseDurationToSec(form.durationInput);
  const durationInvalid = form.durationInput.trim() !== '' && durationSec === null;
  const distanceKm = parseFloat(form.distanceInput);
  const hasDistance = form.distanceInput.trim() !== '';
  const distanceInvalid =
    hasDistance &&
    (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm * 1000 > MAX_DISTANCE_M);
  const cardioInvalid = isCardio && (durationSec === null || distanceInvalid);

  async function handleValidate() {
    if (cardioInvalid) return;
    setSubmitting(true);
    try {
      await onSubmit(
        isCardio
          ? {
              weight: 0,
              reps: 1,
              rir: null,
              durationSec: durationSec!,
              // Stored in meters; the input is km with decimals.
              distanceM: hasDistance && distanceKm > 0 ? Math.round(distanceKm * 1000) : null,
              isWarmup: false,
              isDropSet: false,
              notes: form.notes.trim() || null,
            }
          : {
              weight: form.weight,
              reps: form.reps,
              rir: form.rir,
              durationSec: null,
              distanceM: null,
              isWarmup: form.isWarmup,
              isDropSet: form.isDropSet,
              notes: form.notes.trim() || null,
            },
      );
      // The transition animation to the rest timer is handled by the parent.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {isCardio ? (
          <>
            {/* Duration (required) */}
            <div className="space-y-1">
              <Label
                htmlFor="cardio-duration"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Duration (mm:ss)
              </Label>
              <Input
                id="cardio-duration"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={form.durationInput}
                onChange={(e) => setForm((f) => ({ ...f, durationInput: e.target.value }))}
                placeholder="e.g. 12:30"
                aria-invalid={durationInvalid}
                className="h-14 text-center text-2xl font-semibold"
              />
              {durationInvalid && (
                <p className="text-xs text-muted-foreground">
                  Expected format: mm:ss (e.g. 12:30), h:mm:ss, or plain minutes.
                </p>
              )}
            </div>

            {/* Distance (optional) */}
            <div className="space-y-1">
              <Label
                htmlFor="cardio-distance"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Distance (km, optional)
              </Label>
              <Input
                id="cardio-distance"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.distanceInput}
                onChange={(e) => setForm((f) => ({ ...f, distanceInput: e.target.value }))}
                placeholder="e.g. 2.5"
                aria-invalid={distanceInvalid}
                className="h-14 text-center text-2xl font-semibold"
              />
              {distanceInvalid && (
                <p className="text-xs text-muted-foreground">
                  Enter a distance between 0 and 1000 km.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
        {/* Quick entry shorthand */}
        <div className="space-y-1">
          <Label
            htmlFor="quick-entry"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Quick entry
          </Label>
          <Input
            id="quick-entry"
            type="text"
            inputMode="text"
            autoComplete="off"
            value={quickEntry}
            onChange={(e) => handleQuickEntry(e.target.value)}
            placeholder={`e.g. 100x8@9 (${unitLabel(unit)} x reps @ RPE)`}
            aria-invalid={quickEntryInvalid}
          />
          {quickEntryInvalid && (
            <p className="text-xs text-muted-foreground">
              Expected format: weight x reps, optionally @ RPE - e.g. 100x8 or 62.5x8@8.5
            </p>
          )}
        </div>

        {/* Load */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Load ({unitLabel(unit)})
            </Label>
            <div className="flex items-center gap-1">
              <WarmupCalculator weightKg={form.weight} unit={unit} />
              <PlateCalculator weightKg={form.weight} unit={unit} />
            </div>
          </div>
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
          </>
        )}

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
          disabled={submitting || cardioInvalid}
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
  readiness: ReadinessSignal | null,
  deloadActive: boolean,
): FormState {
  // Cardio exercises (issue #133): prefill the duration/distance from the
  // last cardio set of this session, otherwise leave the inputs empty. The
  // weight/reps machinery below is strength-only.
  if (pe.exercise.category === 'CARDIO') {
    const lastCardio = existingSets.filter((s) => s.durationSec != null).at(-1);
    return {
      weight: 0,
      reps: 1,
      rir: null,
      durationInput: lastCardio?.durationSec != null ? formatDuration(lastCardio.durationSec) : '',
      distanceInput:
        lastCardio?.distanceM != null && lastCardio.distanceM > 0
          ? String(+(lastCardio.distanceM / 1000).toFixed(2))
          : '',
      isWarmup: false,
      isDropSet: false,
      notes: '',
    };
  }

  // 1. If a set already exists for this exercise in the current session,
  //    reuse its values (idea: you aim for the same load, adjust the reps).
  const lastInSession = existingSets.filter((s) => !s.isWarmup).at(-1);
  if (lastInSession) {
    return {
      weight: lastInSession.weight,
      reps: lastInSession.reps,
      rir: lastInSession.rir,
      durationInput: '',
      distanceInput: '',
      isWarmup: false,
      isDropSet: false,
      notes: '',
    };
  }
  // 2. Otherwise, pre-fill with the suggestion (double progression algo). If
  //    progressing, aim for the bottom of the rep range with the heavier
  //    load; otherwise try to beat the previous reps (at least match them).
  if (lastPerf) {
    const suggestion = suggestNextWeight(pe, lastPerf.sets, readiness, deloadActive);
    const initialReps =
      suggestion.reason === 'progression'
        ? pe.targetRepsMin
        : lastPerf.repsAtMaxWeight;
    return {
      weight: suggestion.weight ?? lastPerf.maxWeight,
      reps: initialReps,
      rir: pe.targetRIR,
      durationInput: '',
      distanceInput: '',
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
    durationInput: '',
    distanceInput: '',
    isWarmup: false,
    isDropSet: false,
    notes: '',
  };
}
