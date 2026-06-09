'use client';

import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import type { WeightUnit } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { computePlateLoad } from '@/lib/plates';
import { plateConfigForUnit } from '@/lib/preferences';
import { roundWeight, toDisplayWeight, unitLabel } from '@/lib/units';

interface Props {
  // The current target load, stored in kg (the app's storage unit).
  weightKg: number;
  unit: WeightUnit;
}

// In-workout plate-loading calculator (issue #39). Reads the user's per-unit
// bar weight + plate inventory from preferences and shows the plates to load
// per side for the current target weight. Display-only; never mutates the set.
export function PlateCalculator({ weightKg, unit }: Props) {
  const [open, setOpen] = useState(false);

  // Compute lazily when the dialog opens so localStorage is only read on the
  // client (and only when the user actually wants the calculator).
  const result = useMemo(() => {
    if (!open) return null;
    const { barWeight, plates } = plateConfigForUnit(unit);
    const target = roundWeight(toDisplayWeight(weightKg, unit), 2);
    return { target, ...computePlateLoad(target, barWeight, plates) };
  }, [open, weightKg, unit]);

  const label = unitLabel(unit);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          aria-label="Open the plate calculator"
        >
          <Calculator className="size-4" />
          Plates
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plate calculator</DialogTitle>
          <DialogDescription>
            Plates to load per side for{' '}
            {result ? `${result.target} ${label}` : `the current weight`} on a{' '}
            {result ? `${result.barWeight} ${label}` : ''} bar.
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className="space-y-4">
            {result.perSide.length > 0 ? (
              <div className="flex flex-wrap gap-2" aria-label="Plates per side">
                {result.perSide.map((g) => (
                  <Badge
                    key={g.plate}
                    variant="secondary"
                    className="text-base font-semibold"
                  >
                    {g.count} x {g.plate} {label}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Just the bar - no plates needed.
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              Loads to {result.achievedWeight} {label} (bar {result.barWeight} {label}).
            </p>

            {!result.exact && result.remainder > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-500">
                {result.remainder} {label} cannot be loaded with your available
                plates. Adjust the target or your plate inventory in settings.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
