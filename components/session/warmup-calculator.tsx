'use client';

import { useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
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
import { computeWarmupRamp } from '@/lib/warmup';
import { plateConfigForUnit } from '@/lib/preferences';
import { roundWeight, toDisplayWeight, unitLabel } from '@/lib/units';

interface Props {
  // The current working load, stored in kg (the app's storage unit).
  weightKg: number;
  unit: WeightUnit;
}

// In-workout warm-up ramp calculator (issue #69). Given the working weight, it
// suggests a short ramp of warm-up sets at ascending percentages with
// descending reps, in the user's display unit and rounded to loadable plates.
// Display-only; it never creates or mutates a set (mirrors the plate calculator).
export function WarmupCalculator({ weightKg, unit }: Props) {
  const [open, setOpen] = useState(false);

  // Compute lazily when the dialog opens so the bar weight is only read from
  // localStorage on the client, and only when the user wants the calculator.
  const ramp = useMemo(() => {
    if (!open) return null;
    const { barWeight } = plateConfigForUnit(unit);
    const working = roundWeight(toDisplayWeight(weightKg, unit), 2);
    return computeWarmupRamp(working, unit, barWeight);
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
          aria-label="Open the warm-up calculator"
        >
          <Flame className="size-4" />
          Warm-up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Warm-up ramp</DialogTitle>
          <DialogDescription>
            Suggested warm-up sets up to a working weight of{' '}
            {ramp ? `${ramp.workingWeight} ${label}` : 'the current weight'}.
          </DialogDescription>
        </DialogHeader>

        {ramp && (
          <div className="space-y-4">
            {ramp.sets.length > 0 ? (
              <ol className="space-y-2" aria-label="Warm-up sets">
                {ramp.sets.map((set, index) => (
                  <li
                    key={`${set.weight}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="text-base font-semibold">
                      {set.weight} {label}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {set.percent}%
                      </span>
                    </span>
                    <Badge variant="secondary" className="text-sm font-semibold">
                      {set.reps} reps
                    </Badge>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                This load is at or below the bar - no warm-up ramp needed.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Suggestions only - log your warm-ups with the Warmup toggle. Weights
              are rounded down to loadable plates.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
