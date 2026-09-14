'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calculator } from 'lucide-react';
import type { WeightUnit } from '@/lib/prisma-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { computeBestPlateLoad, type PlateLoad } from '@/lib/plates';
import { plateConfigForUnit } from '@/lib/preferences';
import { roundWeight, toDisplayWeight, unitLabel } from '@/lib/units';

interface Props {
  // The current target load, stored in kg (the app's storage unit).
  weightKg: number;
  unit: WeightUnit;
  barWeightsKg?: number[];
  plateWeightsKg?: number[];
}

// In-workout plate-loading calculator (issue #39). Reads the user's per-unit
// bar weight + plate inventory from preferences and shows the plates to load
// per side for the current target weight. Display-only; never mutates the set.
export function PlateCalculator({ weightKg, unit, barWeightsKg, plateWeightsKg }: Props) {
  const t = useTranslations('session.calculator');
  const [open, setOpen] = useState(false);

  // Compute lazily when the dialog opens so localStorage is only read on the
  // client (and only when the user actually wants the calculator).
  const result = useMemo(() => {
    if (!open) return null;
    const fallback = plateConfigForUnit(unit);
    const bars = barWeightsKg?.length
      ? barWeightsKg.map((weight) => roundWeight(toDisplayWeight(weight, unit), 2))
      : [fallback.barWeight];
    const plates = plateWeightsKg?.length
      ? plateWeightsKg.map((weight) => roundWeight(toDisplayWeight(weight, unit), 2))
      : fallback.plates;
    const target = roundWeight(toDisplayWeight(weightKg, unit), 2);
    const result = computeBestPlateLoad(target, bars, plates, fallback.barWeight);
    return { target, ...result };
  }, [barWeightsKg, open, plateWeightsKg, weightKg, unit]);

  const label = unitLabel(unit);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          aria-label={t('openPlates')}
        >
          <Calculator className="size-4" />
          {t('plates')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('plates')}</DialogTitle>
          <DialogDescription>
            {t('plateDescription', {
              target: result ? `${result.target} ${label}` : t('currentWeight'),
              bar: result ? `${result.barWeight} ${label}` : '',
            })}
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className="space-y-4">
            {result.perSide.length > 0 ? (
              <BarbellSideDiagram
                load={result}
                unitLabel={label}
                platesLabel={t('platesPerSide')}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t('barOnly')}</p>
            )}

            <p className="text-sm text-muted-foreground">
              {t('achieved', {
                weight: `${result.achievedWeight} ${label}`,
                bar: `${result.barWeight} ${label}`,
              })}
            </p>

            {!result.exact && result.remainder > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-500">
                {t('remainder', { remainder: `${result.remainder} ${label}` })}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BarbellSideDiagram({
  load,
  unitLabel,
  platesLabel,
}: {
  load: PlateLoad;
  unitLabel: string;
  platesLabel: string;
}) {
  const plates = load.perSide.flatMap((group) =>
    Array.from({ length: group.count }, (_, index) => ({
      weight: group.plate,
      key: String(group.plate) + '-' + String(index),
    })),
  );
  const maxPlate = Math.max(...plates.map((plate) => plate.weight), 1);

  return (
    <div className="rounded-md border bg-muted/20 p-3" data-testid="barbell-side-diagram">
      <div className="relative mx-auto grid min-h-16 max-w-sm grid-cols-[minmax(2.5rem,1fr)_max-content_minmax(1.25rem,0.6fr)] items-center">
        <div className="absolute inset-x-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-zinc-500" />
        <span aria-hidden />
        <div className="relative z-10 flex h-14 items-center gap-0.5" aria-label={platesLabel}>
          <div className="mr-0.5 h-10 w-3 shrink-0 rounded-sm bg-zinc-400" aria-hidden />
          {plates.map((plate) => (
            <div
              key={plate.key}
              className="flex w-5 shrink-0 items-center justify-center rounded-sm border border-zinc-300 bg-zinc-700 text-[0.6rem] font-bold text-white"
              style={{ height: String(Math.round(26 + (plate.weight / maxPlate) * 26)) + 'px' }}
              title={String(plate.weight) + ' ' + unitLabel}
            >
              <span className="-rotate-90 whitespace-nowrap">{plate.weight}</span>
            </div>
          ))}
        </div>
        <span aria-hidden />
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        {load.perSide
          .map((group) => String(group.count) + ' x ' + String(group.plate) + ' ' + unitLabel)
          .join(' + ')}
      </p>
    </div>
  );
}
