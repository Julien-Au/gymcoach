'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { Exercise, ProgramExercise, WeightUnit } from '@/lib/prisma-client';
import type { PendingSet } from '@/lib/indexeddb';
import type { SerializedLastPerformance } from '@/components/session/session-runner';
import type { IntraSetRecommendation } from '@/lib/intra-set-autoregulation';
import type { GymLoadConstraints } from '@/lib/gym-loads';
import { constrainGymWeight, gymWeightOptions } from '@/lib/gym-loads';
import { suggestNextWeight, type ReadinessSignal } from '@/lib/progression';
import { estimate1RM } from '@/lib/stats';
import { formatWeight, fromDisplayWeight, roundWeight, toDisplayWeight } from '@/lib/units';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface Props {
  programExercise: ProgramExercise & { exercise: Exercise };
  sets: PendingSet[];
  lastPerformance: SerializedLastPerformance | undefined;
  readiness: ReadinessSignal | null;
  deloadActive: boolean;
  unit: WeightUnit;
  recommendation?: IntraSetRecommendation | null;
  loadConstraints?: GymLoadConstraints | null;
  equipmentOptions?: { id: string; name: string }[];
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
    gymEquipmentId?: string | null;
  }) => Promise<void>;
  onDeleteSet: (set: PendingSet) => Promise<boolean | void> | boolean | void;
  onUpdateSet: (set: PendingSet, values: DraftSet) => Promise<void>;
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
  loadConstraints: GymLoadConstraints | null,
): DraftSet {
  const workingSets = sets.filter((set) => !set.isWarmup);
  const previousRow = lastPerformance?.sets[workingSets.length];
  if (previousRow) {
    return { weight: previousRow.weight, reps: previousRow.reps, rir: previousRow.rir };
  }

  const lastWorking = workingSets.at(-1);
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
  equipmentOptions = [],
  disabled = false,
  onSubmit,
  onDeleteSet,
  onUpdateSet,
}: Props) {
  const t = useTranslations('session.editableSets');
  const inputT = useTranslations('session.input');
  const locale = useLocale();
  const [draft, setDraft] = useState<DraftSet>(() =>
    initialDraft(programExercise, sets, lastPerformance, readiness, deloadActive, loadConstraints),
  );
  const [submitting, setSubmitting] = useState(false);
  const [editingSet, setEditingSet] = useState<{ set: PendingSet; draft: DraftSet } | null>(null);
  const [updatingSetId, setUpdatingSetId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'weight' | 'reps' | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [appliedRecommendationKey, setAppliedRecommendationKey] = useState<string | null>(null);
  const [gymEquipmentId, setGymEquipmentId] = useState('');
  const workingSets = useMemo(() => sets.filter((set) => !set.isWarmup), [sets]);
  const latestWorkingSetId = workingSets.at(-1)?.localId ?? null;

  useEffect(() => {
    setDraft(
      initialDraft(programExercise, sets, lastPerformance, readiness, deloadActive, loadConstraints),
    );
    setEditingSet(null);
    setPicker(null);
    setAppliedRecommendationKey(null);
    const recentEquipmentId = workingSets.at(-1)?.gymEquipmentId ?? '';
    setGymEquipmentId(
      equipmentOptions.some((equipment) => equipment.id === recentEquipmentId)
        ? recentEquipmentId
        : '',
    );
    // Re-seed when the active exercise or logged working-set count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programExercise.id, workingSets.length]);

  useEffect(() => {
    if (gymEquipmentId && !equipmentOptions.some((equipment) => equipment.id === gymEquipmentId)) {
      setGymEquipmentId('');
    }
  }, [equipmentOptions, gymEquipmentId]);

  const currentNumber = workingSets.length + 1;
  const totalRows = Math.max(programExercise.targetSets, currentNumber);
  const displayWeight =
    unit === 'LB' ? roundWeight(toDisplayWeight(draft.weight, unit), 1) : draft.weight;
  const rmValue = estimate1RM(draft.weight, draft.reps);
  const availableWeights = useMemo(() => {
    const constrained = gymWeightOptions(loadConstraints, draft.weight);
    if (constrained.length > 0) return constrained;
    const step = programExercise.exercise.category === 'ISOLATION' ? 1 : 2.5;
    return Array.from({ length: 81 }, (_, index) => +(index * step).toFixed(2));
  }, [draft.weight, loadConstraints, programExercise.exercise.category]);
  const repOptions = useMemo(() => Array.from({ length: 30 }, (_, index) => index + 1), []);
  const recommendationKey = recommendation
    ? `${recommendation.weight}:${recommendation.reps}:${recommendation.rir}`
    : null;
  const canApplyRecommendation =
    recommendation != null && appliedRecommendationKey !== recommendationKey;

  function applyRecommendation() {
    if (!recommendation || disabled) return;
    setEditingSet(null);
    setPicker(null);
    setDraft({ weight: recommendation.weight, reps: recommendation.reps, rir: recommendation.rir });
    setAppliedRecommendationKey(recommendationKey);
  }

  function openPicker(kind: 'weight' | 'reps', set?: PendingSet) {
    const source = set
      ? editingSet?.set.localId === set.localId
        ? editingSet.draft
        : { weight: set.weight, reps: set.reps, rir: set.rir }
      : draft;
    if (set && editingSet?.set.localId !== set.localId) {
      setEditingSet({ set, draft: source });
    } else if (!set) {
      setEditingSet(null);
    }
    setPicker(kind);
    setManualValue(
      kind === 'weight'
        ? String(
            unit === 'LB' ? roundWeight(toDisplayWeight(source.weight, unit), 1) : source.weight,
          )
        : String(source.reps),
    );
  }

  function chooseValue(value: number, canonicalWeight?: number) {
    const updateDraft = (current: DraftSet): DraftSet =>
      picker === 'weight'
        ? { ...current, weight: canonicalWeight ?? fromDisplayWeight(value, unit) }
        : { ...current, reps: Math.max(1, Math.round(value)) };
    if (editingSet) {
      const nextDraft = updateDraft(editingSet.draft);
      setPicker(null);
      void persistEditedSet(editingSet.set, nextDraft);
      return;
    }
    setDraft(updateDraft);
    setAppliedRecommendationKey(null);
    setPicker(null);
  }

  async function persistEditedSet(set: PendingSet, nextDraft: DraftSet) {
    if (disabled || updatingSetId === set.localId || nextDraft.reps <= 0 || nextDraft.weight < 0)
      return;
    const normalized = {
      ...nextDraft,
      weight: constrainGymWeight(nextDraft.weight, nextDraft.weight, loadConstraints),
    };
    setEditingSet({ set, draft: normalized });
    setUpdatingSetId(set.localId);
    try {
      await onUpdateSet(set, normalized);
      setEditingSet(null);
    } catch {
      setEditingSet(null);
    } finally {
      setUpdatingSetId(null);
    }
  }

  function updateEditingRir(set: PendingSet, rir: number | null) {
    const current =
      editingSet?.set.localId === set.localId
        ? editingSet.draft
        : { weight: set.weight, reps: set.reps, rir: set.rir };
    void persistEditedSet(set, { ...current, rir });
  }

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
        gymEquipmentId: gymEquipmentId || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-md border border-border">
      {equipmentOptions.length > 0 && (
        <div className="border-b border-border px-3 py-2">
          <label
            htmlFor="inline-gym-equipment"
            className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground"
          >
            {inputT('equipment')}
          </label>
          <select
            id="inline-gym-equipment"
            value={gymEquipmentId}
            disabled={disabled}
            onChange={(event) => setGymEquipmentId(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{inputT('equipmentNone')}</option>
            {equipmentOptions.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div data-testid="editable-sets-scroll" className="overflow-x-auto overscroll-x-contain">
        <div data-testid="editable-sets-grid" className="min-w-[31rem]">
          <div className="grid grid-cols-[2.5rem_minmax(5rem,1fr)_4.5rem_4rem_5rem_3.25rem] items-center gap-1 border-b border-border bg-muted/30 px-2 py-2 text-center text-[0.6875rem] font-medium uppercase text-muted-foreground">
            <span>#</span>
            <span>{unit}</span>
            <span>REPS</span>
            <span>RIR</span>
            <span>1RM</span>
            <span aria-hidden />
          </div>

          {workingSets.map((set) => {
            const isEditing = editingSet?.set.localId === set.localId;
            const rowDraft = isEditing
              ? editingSet.draft
              : { weight: set.weight, reps: set.reps, rir: set.rir };
            const isUpdating = updatingSetId === set.localId;
            return (
              <div
                key={set.localId}
                className="grid grid-cols-[2.5rem_minmax(5rem,1fr)_4.5rem_4rem_5rem_3.25rem] items-center gap-1 border-b border-border px-2 py-2 text-center text-sm tabular-nums"
              >
                <span className="text-muted-foreground">{set.setNumber}</span>
                <button
                  type="button"
                  disabled={disabled || isUpdating}
                  onClick={() => openPicker('weight', set)}
                  aria-label={t('weight', { number: set.setNumber, unit })}
                  className="h-9 rounded-md border border-transparent bg-transparent font-medium hover:bg-muted/40"
                >
                  {formatWeight(rowDraft.weight, unit, {
                    decimals: 2,
                    group: false,
                    locale,
                    withUnit: false,
                  })}
                </button>
                <button
                  type="button"
                  disabled={disabled || isUpdating}
                  onClick={() => openPicker('reps', set)}
                  aria-label={t('reps', { number: set.setNumber })}
                  className="h-9 rounded-md border border-transparent bg-transparent font-medium hover:bg-muted/40"
                >
                  {rowDraft.reps}
                </button>
                <select
                  aria-label={t('rir', { number: set.setNumber })}
                  value={rowDraft.rir ?? ''}
                  disabled={disabled || isUpdating}
                  onChange={(event) =>
                    updateEditingRir(
                      set,
                      event.target.value === '' ? null : Number(event.target.value),
                    )
                  }
                  className="h-9 rounded-md border border-transparent bg-transparent text-center"
                >
                  <option value="">-</option>
                  {[0, 1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground">
                  {formatWeight(estimate1RM(rowDraft.weight, rowDraft.reps), unit, {
                    decimals: 1,
                    group: false,
                    locale,
                  })}
                </span>
                <span className="flex items-center justify-center">
                  {isUpdating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void onDeleteSet(set)}
                      aria-label={
                        set.localId === latestWorkingSetId
                          ? t('undo', { number: set.setNumber })
                          : t('delete', { number: set.setNumber })
                      }
                      className="size-9 text-muted-foreground hover:text-destructive"
                    >
                      {set.localId === latestWorkingSetId ? (
                        <RotateCcw className="size-4" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  )}
                </span>
              </div>
            );
          })}

          <div className="grid grid-cols-[2.5rem_minmax(5rem,1fr)_4.5rem_4rem_5rem_3.25rem] items-center gap-1 border-b border-border bg-primary/5 px-2 py-2">
            {recommendation ? (
              <button
                type="button"
                onClick={applyRecommendation}
                disabled={disabled || !canApplyRecommendation}
                aria-label={t('applyRecommendation', { number: currentNumber })}
                title={t('applyRecommendation', { number: currentNumber })}
                className="relative mx-auto flex size-7 items-center justify-center rounded-md text-sm font-semibold text-primary hover:bg-primary/10 disabled:cursor-default disabled:opacity-100"
              >
                {currentNumber}
                {canApplyRecommendation && (
                  <span
                    data-testid="set-recommendation-dot"
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-background"
                  />
                )}
              </button>
            ) : (
              <span className="text-center text-sm font-semibold text-primary">{currentNumber}</span>
            )}
            <button
              type="button"
              onClick={() => openPicker('weight')}
              aria-label={t('weight', { number: currentNumber, unit })}
              className="h-11 rounded-md border border-input bg-background px-2 text-center text-base font-semibold tabular-nums"
            >
              {displayWeight}
            </button>
            <button
              type="button"
              onClick={() => openPicker('reps')}
              aria-label={t('reps', { number: currentNumber })}
              className="h-11 rounded-md border border-input bg-background px-1 text-center text-base font-semibold tabular-nums"
            >
              {draft.reps}
            </button>
            <select
              aria-label={t('rir', { number: currentNumber })}
              value={draft.rir ?? ''}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  rir: event.target.value === '' ? null : Number(event.target.value),
                }));
                setAppliedRecommendationKey(null);
              }}
              className="h-11 rounded-md border border-input bg-background px-1 text-center text-base font-semibold"
            >
              <option value="">-</option>
              {[0, 1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <span className="text-center text-sm font-medium tabular-nums text-muted-foreground">
              {rmValue > 0
                ? formatWeight(rmValue, unit, { decimals: 1, group: false, locale })
                : '-'}
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

          {Array.from({ length: Math.max(0, totalRows - currentNumber) }, (_, index) => {
            const rowNumber = currentNumber + index + 1;
            const previous = lastPerformance?.sets[rowNumber - 1];
            return (
              <div
                key={`upcoming-${rowNumber}`}
                className="grid grid-cols-[2.5rem_minmax(5rem,1fr)_4.5rem_4rem_5rem_3.25rem] items-center gap-1 border-b border-border px-2 py-3 text-center text-sm text-muted-foreground last:border-b-0"
              >
                <span>{rowNumber}</span>
                <span>
                  {previous
                    ? formatWeight(previous.weight, unit, {
                        decimals: 2,
                        group: false,
                        locale,
                        withUnit: false,
                      })
                    : '-'}
                </span>
                <span>{previous?.reps ?? '-'}</span>
                <span>{previous?.rir ?? '-'}</span>
                <span>
                  {previous
                    ? formatWeight(estimate1RM(previous.weight, previous.reps), unit, {
                        decimals: 1,
                        group: false,
                        locale,
                      })
                    : '-'}
                </span>
                <span />
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={picker != null} onOpenChange={(open) => !open && setPicker(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="bottom-0 left-0 top-auto max-h-[82vh] w-full max-w-none translate-x-0 translate-y-0 gap-3 rounded-t-lg border-x-0 border-b-0 p-4 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border"
        >
          <DialogTitle>
            {picker === 'weight' ? t('chooseWeight', { unit }) : t('chooseReps')}
          </DialogTitle>
          <div className="flex gap-2">
            <Input
              autoFocus
              type="number"
              inputMode={picker === 'weight' ? 'decimal' : 'numeric'}
              step={picker === 'weight' ? '0.1' : '1'}
              min="0"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              className="h-12 text-center text-xl font-semibold tabular-nums"
            />
            <Button
              type="button"
              size="icon"
              className="size-12 shrink-0"
              onClick={() => chooseValue(Number(manualValue) || 0)}
              aria-label={t('applyValue')}
            >
              <Check className="size-6" />
            </Button>
          </div>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto overscroll-contain py-1">
            {(picker === 'weight' ? availableWeights : repOptions).map((value) => {
              const shown =
                picker === 'weight'
                  ? unit === 'LB'
                    ? roundWeight(toDisplayWeight(value, unit), 1)
                    : value
                  : value;
              const activeDraft = editingSet?.draft ?? draft;
              const selected =
                picker === 'weight' ? value === activeDraft.weight : value === activeDraft.reps;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseValue(shown, picker === 'weight' ? value : undefined)}
                  className={`flex h-16 w-full items-center justify-center rounded-md border text-xl font-semibold tabular-nums ${
                    selected ? 'border-primary bg-primary/10' : 'border-border bg-muted/40'
                  }`}
                >
                  {shown} {picker === 'weight' ? unit.toLowerCase() : t('repsShort')}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
