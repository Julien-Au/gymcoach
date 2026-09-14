'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WeightUnit } from '@/lib/prisma-client';
import type { GymLoadConstraints } from '@/lib/gym-loads';
import { computePlateLoad, type PlateLoad } from '@/lib/plates';
import { plateConfigForUnit } from '@/lib/preferences';
import { roundWeight, toDisplayWeight } from '@/lib/units';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface PickerOption {
  value: number;
  canonicalValue?: number;
  label?: string;
}

interface Props {
  open: boolean;
  kind: 'weight' | 'reps';
  value: number;
  options: PickerOption[];
  unit: WeightUnit;
  loadConstraints?: GymLoadConstraints | null;
  onClose: () => void;
  onChoose: (value: number, canonicalValue?: number) => void;
}

export function SetValuePicker({
  open,
  kind,
  value,
  options,
  unit,
  loadConstraints = null,
  onClose,
  onChoose,
}: Props) {
  const t = useTranslations('session.editableSets');
  const [pendingValue, setPendingValue] = useState(value);
  const [manualValue, setManualValue] = useState(String(value));
  const [manualEntryActive, setManualEntryActive] = useState(false);
  const [wheelPadding, setWheelPadding] = useState(12);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setManualEntryActive(false);
    const nearest = kind === 'weight' ? nearestOption(options, value)?.value : value;
    setPendingValue(nearest ?? value);
    setManualValue(String(nearest ?? value));
    const timer = window.setTimeout(() => {
      listRef.current
        ?.querySelector<HTMLElement>('[data-picker-selected="true"]')
        ?.scrollIntoView?.({ block: 'center' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [kind, open, options, value]);

  useEffect(() => {
    if (!open || kind !== 'weight' || !listRef.current) return;
    const list = listRef.current;
    const updatePadding = () => setWheelPadding(Math.max(12, (list.clientHeight - 64) / 2));
    updatePadding();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updatePadding);
    observer.observe(list);
    return () => observer.disconnect();
  }, [kind, open]);

  function selectOption(option: PickerOption, element: HTMLElement) {
    setManualEntryActive(false);
    setPendingValue(option.value);
    setManualValue(String(option.value));
    if (kind !== 'weight') return;
    const list = listRef.current;
    if (!list) return;
    const top = element.offsetTop - (list.clientHeight - element.offsetHeight) / 2;
    list.scrollTo?.({ top, behavior: 'smooth' });
  }

  function previewCenteredWeight() {
    if (kind !== 'weight' || manualEntryActive || !listRef.current) return;
    const list = listRef.current;
    const listRect = list.getBoundingClientRect();
    const centerY = listRect.top + list.clientHeight / 2;
    const nearest = Array.from(
      list.querySelectorAll<HTMLElement>('[data-picker-option-value]'),
    ).reduce<{ value: number; distance: number } | null>((best, element) => {
      const option = Number(element.dataset.pickerOptionValue);
      if (!Number.isFinite(option)) return best;
      const rect = element.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - centerY);
      return best == null || distance < best.distance ? { value: option, distance } : best;
    }, null);
    if (!nearest || nearlyEqual(nearest.value, pendingValue)) return;
    setPendingValue(nearest.value);
    setManualValue(String(nearest.value));
  }

  const parsedManualValue = Number(manualValue);
  const previewWeight = manualEntryActive ? parsedManualValue : pendingValue;
  const plateLoad = useMemo(() => {
    if (
      kind !== 'weight' ||
      loadConstraints?.equipmentType !== 'BARBELL' ||
      !Number.isFinite(previewWeight) ||
      previewWeight <= 0
    ) {
      return null;
    }
    const fallback = plateConfigForUnit(unit);
    const bars = loadConstraints.barWeights?.length
      ? loadConstraints.barWeights.map((weight) => roundWeight(toDisplayWeight(weight, unit), 2))
      : [fallback.barWeight];
    const plates = loadConstraints.plateWeights?.length
      ? loadConstraints.plateWeights.map((weight) => roundWeight(toDisplayWeight(weight, unit), 2))
      : fallback.plates;
    return bestPlateLoad(previewWeight, bars, plates, fallback.barWeight);
  }, [kind, loadConstraints, previewWeight, unit]);

  function applyManual() {
    const parsed = parsedManualValue;
    if (!Number.isFinite(parsed) || parsed < 0) return;
    if (kind === 'reps') {
      onChoose(Math.max(1, Math.round(parsed)));
      return;
    }
    const matchingOption = options.find((option) => nearlyEqual(option.value, parsed));
    if (matchingOption?.canonicalValue != null) {
      onChoose(parsed, matchingOption.canonicalValue);
    } else {
      onChoose(parsed);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="bottom-0 left-0 top-auto max-h-[82vh] w-full max-w-none translate-x-0 translate-y-0 gap-3 rounded-t-lg border-x-0 border-b-0 p-4 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border"
      >
        <DialogTitle>
          {kind === 'weight' ? t('chooseWeight', { unit }) : t('chooseReps')}
        </DialogTitle>

        <div className="flex gap-2">
          <Input
            autoFocus
            type="number"
            inputMode={kind === 'weight' ? 'decimal' : 'numeric'}
            step={kind === 'weight' ? '0.1' : '1'}
            min="0"
            value={manualValue}
            onChange={(event) => {
              setManualEntryActive(true);
              setManualValue(event.target.value);
            }}
            className="h-12 text-center text-xl font-semibold tabular-nums"
          />
          <Button
            type="button"
            size="icon"
            className="size-12 shrink-0"
            onClick={applyManual}
            aria-label={t('applyValue')}
          >
            <Check className="size-6" />
          </Button>
        </div>

        {kind === 'weight' && plateLoad ? (
          <BarbellSideDiagram load={plateLoad} targetWeight={previewWeight} unit={unit} />
        ) : null}

        <div className="relative min-h-0">
          <div
            ref={listRef}
            data-testid="set-value-options"
            data-weight-picker-list={kind === 'weight' ? 'true' : undefined}
            onPointerDown={() => kind === 'weight' && setManualEntryActive(false)}
            onWheel={() => kind === 'weight' && setManualEntryActive(false)}
            onScroll={previewCenteredWeight}
            style={
              kind === 'weight'
                ? { paddingTop: wheelPadding, paddingBottom: wheelPadding }
                : undefined
            }
            className={`max-h-[55vh] space-y-2 overflow-y-auto overscroll-contain ${
              kind === 'weight' ? 'snap-y snap-mandatory scroll-smooth' : 'py-1'
            }`}
          >
            {options.map((option) => {
              const selected = nearlyEqual(option.value, pendingValue);
              return (
                <button
                  key={`${option.value}:${option.canonicalValue ?? ''}`}
                  type="button"
                  data-picker-option-value={kind === 'weight' ? option.value : undefined}
                  data-picker-option-canonical={option.canonicalValue}
                  data-picker-selected={selected ? 'true' : undefined}
                  onClick={(event) => selectOption(option, event.currentTarget)}
                  className={`mx-auto flex h-16 w-full max-w-[15rem] items-center justify-center rounded-md border text-xl font-semibold tabular-nums ${
                    kind === 'weight' ? 'snap-center' : ''
                  } ${selected ? 'border-primary bg-primary/10' : 'border-border bg-muted/40'}`}
                >
                  {option.label ?? option.value}{' '}
                  {kind === 'weight' ? unit.toLowerCase() : t('repsShort')}
                </button>
              );
            })}
          </div>

          {kind === 'weight' && options.length > 0 ? (
            <div
              data-testid="weight-picker-pointer"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between text-primary"
            >
              <ChevronRight className="size-8" />
              <ChevronLeft className="size-8" />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function nearestOption(options: PickerOption[], value: number): PickerOption | null {
  return options.reduce<PickerOption | null>((best, option) => {
    if (best == null) return option;
    return Math.abs(option.value - value) < Math.abs(best.value - value) ? option : best;
  }, null);
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-9;
}

function bestPlateLoad(
  targetWeight: number,
  barWeights: number[],
  plateWeights: number[],
  fallbackBarWeight: number,
): PlateLoad {
  const candidates = (barWeights.length > 0 ? barWeights : [fallbackBarWeight]).map((barWeight) =>
    computePlateLoad(targetWeight, barWeight, plateWeights),
  );
  return candidates.sort(
    (left, right) =>
      Number(right.exact) - Number(left.exact) ||
      left.remainder - right.remainder ||
      right.achievedWeight - left.achievedWeight,
  )[0]!;
}

function BarbellSideDiagram({
  load,
  targetWeight,
  unit,
}: {
  load: PlateLoad;
  targetWeight: number;
  unit: WeightUnit;
}) {
  const t = useTranslations('session.calculator');
  const plates = load.perSide.flatMap((group) =>
    Array.from({ length: group.count }, (_, index) => ({
      weight: group.plate,
      key: `${group.plate}-${index}`,
    })),
  );
  const maxPlate = Math.max(...plates.map((plate) => plate.weight), 1);

  return (
    <div
      className="rounded-md border border-border bg-muted/20 px-3 py-2"
      data-testid="barbell-side-diagram"
      data-target-weight={targetWeight}
    >
      <div
        className="relative flex h-12 items-center overflow-hidden"
        aria-label={t('platesPerSide')}
      >
        <div className="absolute left-1 right-0 h-2 rounded-sm bg-zinc-500" />
        <div className="relative z-10 ml-1 h-8 w-3 shrink-0 rounded-sm bg-zinc-400" />
        <div className="relative z-10 flex items-center gap-0.5">
          {plates.map((plate) => {
            const ratio = plate.weight / maxPlate;
            return (
              <div
                key={plate.key}
                className="flex w-4 shrink-0 items-center justify-center rounded-sm border border-zinc-300 bg-zinc-700 text-[0.55rem] font-bold text-white"
                style={{ height: `${Math.round(22 + ratio * 24)}px` }}
                title={`${plate.weight} ${unit.toLowerCase()}`}
              >
                <span className="-rotate-90 whitespace-nowrap">{plate.weight}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {load.exact ? <LockKeyhole className="size-3 text-emerald-500" /> : null}
        <span>
          {t('achieved', {
            weight: `${load.achievedWeight} ${unit.toLowerCase()}`,
            bar: `${load.barWeight} ${unit.toLowerCase()}`,
          })}
        </span>
      </div>
    </div>
  );
}
