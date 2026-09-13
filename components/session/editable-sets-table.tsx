'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { Exercise, ProgramExercise, WeightUnit } from '@/lib/prisma-client';
import type { PendingSet } from '@/lib/indexeddb';
import type { SerializedLastPerformance } from '@/components/session/session-runner';
import type { IntraSetRecommendation } from '@/lib/intra-set-autoregulation';
import type { GymLoadConstraints } from '@/lib/gym-loads';
import { constrainGymWeight } from '@/lib/gym-loads';
import { suggestNextWeight, type ReadinessSignal } from '@/lib/progression';
import { estimate1RM } from '@/lib/stats';
import { formatWeight, fromDisplayWeight, roundWeight, toDisplayWeight } from '@/lib/units';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  programExercise: ProgramExercise & { exercise: Exercise };
  sets: PendingSet[];
  lastPerformance: SerializedLastPerformance | undefined;
  readiness: ReadinessSignal | null;
  deloadActive: boolean;
  unit: WeightUnit;
  recommendation?: IntraSetRecommendation | null;
  loadConstraints?: GymLoadConstraints | null;
  disabled?: boolean;
  onSubmit: (values: {
    weight: number;
    reps: number;
    rir: number | null;
    durationSec: null;
    distanceM: null;
    isWarmup: false;
    isDropSet: false;
    notes: null;
  }) => Promise<void>;
  onDeleteSet: (set: PendingSet) => void;
}

interface DraftSet {
  weight: number;
  reps: number;
  rir: number | null;
}

function initialDraft(
  pe: Props['programExercise'],
  sets: PendingSet[],
  lastPerformance: SerializedLastPerformance | undefined,
  readiness: ReadinessSignal | null,
  deloadActive: boolean,
  recommendation: IntraSetRecommendation | null,
  loadConstraints: GymLoadConstraints | null,
): DraftSet {
  if (recommendation) {
    return {
      weight: recommendation.weight,
      reps: recommendation.reps,
      rir: recommendation.rir,
    };
  }

  const lastWorking = sets.filter((set) => !set.isWarmup).at(-1);
  if (lastWorking) {
    return { weight: lastWorking.weight, reps: lastWorking.reps, rir: lastWorking.rir };
  }

  if (lastPerformance) {
    const suggestion = suggestNextWeight(
      pe,
      lastPerformance.sets,
      readiness,
      deloadActive,
      loadConstraints,
    );
    return {
      weight: suggestion.weight ?? lastPerformance.maxWeight,
      reps:
        suggestion.reason === 'progression'
          ? pe.targetRepsMin
          : Math.max(pe.targetRepsMin, lastPerformance.repsAtMaxWeight),
      rir: pe.targetRIR,
    };
  }

  return {
    weight: 0,
    reps: Math.round((pe.targetRepsMin + pe.targetRepsMax) / 2),
    rir: pe.targetRIR,
  };
}

export function EditableSetsTable({
  programExercise,
  sets,
  lastPerformance,
  readiness,
  deloadActive,
  unit,
  recommendation = null,
  loadConstraints = null,
  disabled = false,
  onSubmit,
  onDeleteSet,
}: Props) {
  const t = useTranslations('session.editableSets');
  const locale = useLocale();
  const [draft, setDraft] = useState<DraftSet>(() =>
    initialDraft(
      programExercise,
      sets,
      lastPerformance,
      readiness,
      deloadActive,
      recommendation,
      loadConstraints,
    ),
  );
  const [submitting, setSubmitting] = useState(false);

  const workingSets = useMemo(() => sets.filter((set) => !set.isWarmup), [sets]);
  const currentNumber = workingSets.length + 1;
  const totalRows = Math.max(programExercise.targetSets, currentNumber);
  const displayWeight =
    unit === 'LB' ? roundWeight(toDisplayWeight(draft.weight, unit), 1) : draft.weight;
  const rmValue = estimate1RM(draft.weight, draft.reps);

  async function confirmRow() {
    if (disabled || submitting || draft.reps <= 0 || draft.weight < 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        weight: constrainGymWeight(draft.weight, draft.weight, loadConstraints),
        reps: draft.reps,
        rir: draft.rir,
        durationSec: null,
        distanceM: null,
        isWarmup: false,
        isDropSet: false,
        notes: null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <div className="min-w-[31rem]">
          <div className="grid grid-cols-[2.5rem_minmax(5rem,1fr)_4.5rem_4rem_5rem_3.25rem] items-center gap-1 border-b border-border bg-muted/30 px-2 py-2 text-center text-[0.6875rem] font-medium uppercase text-muted-foreground">
            <span>#</span>
            <span>{unit}</span>
            <span>REPS</span>
            <span>RIR</span>
            <span>1RM</span>
            <span aria-hidden />
          </div>

          {workingSets.map((set) => (
            <div
              key={set.localId}
              className="grid grid-cols-[2.5rem_minmax(5rem,1fr)_4.5rem_4rem_5rem_3.25rem] items-center gap-1 border-b border-border px-2 py-2 text-center text-sm tabular-nums"
            >
              <span className="text-muted-foreground">{set.setNumber}</span>
              <span className="font-medium">
                {formatWeight(set.weight, unit, { decimals: 2, group: false, locale, withUnit: false })}
              </span>
              <span className="font-medium">{set.reps}</span>
              <span>{set.rir ?? '–'}</span>
              <span className="text-muted-foreground">
                {formatWeight(estimate1RM(set.weight, set.reps), unit, {
                  decimals: 1,
                  group: false,
                  locale,
                })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onDeleteSet(set)}
                aria-label={t('delete', { number: set.setNumber })}
                className="size-9 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <div className="grid grid-cols-[2.5rem_minmax(5rem,1fr)_4.5rem_4rem_5rem_3.25rem] items-center gap-1 border-b border-border bg-primary/5 px-2 py-2">
            <span className="text-center text-sm font-semibold text-primary">{currentNumber}</span>
            <Input
              aria-label={t('weight', { number: currentNumber, unit })}
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={displayWeight}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  weight: fromDisplayWeight(Number(event.target.value) || 0, unit),
                }))
              }
              className="h-11 px-2 text-center text-base font-semibold tabular-nums"
            />
            <Input
              aria-label={t('reps', { number: currentNumber })}
              type="number"
              inputMode="numeric"
              min="1"
              value={draft.reps}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  reps: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                }))
              }
              className="h-11 px-1 text-center text-base font-semibold tabular-nums"
            />
            <select
              aria-label={t('rir', { number: currentNumber })}
              value={draft.rir ?? ''}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  rir: event.target.value === '' ? null : Number(event.target.value),
                }))
              }
              className="h-11 rounded-md border border-input bg-background px-1 text-center text-base font-semibold"
            >
              <option value="">–</option>
              {[0, 1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <span className="text-center text-sm font-medium tabular-nums text-muted-foreground">
              {rmValue > 0
                ? formatWeight(rmValue, unit, { decimals: 1, group: false, locale })
                : '–'}
            </span>
            <Button
              type="button"
              size="icon"
              onClick={confirmRow}
              disabled={disabled || submitting || draft.reps <= 0}
              aria-label={t('confirm', { number: currentNumber })}
              className="size-11"
            >
              {submitting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Check className="size-6" />
              )}
            </Button>
          </div>

          {Array.from({ length: Math.max(0, totalRows - currentNumber) }, (_, index) => (
            <div
              key={`upcoming-${currentNumber + index + 1}`}
              className="grid grid-cols-[2.5rem_minmax(5rem,1fr)_4.5rem_4rem_5rem_3.25rem] items-center gap-1 border-b border-border px-2 py-3 text-center text-sm text-muted-foreground last:border-b-0"
            >
              <span>{currentNumber + index + 1}</span>
              <span>–</span>
              <span>–</span>
              <span>–</span>
              <span>–</span>
              <span />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
