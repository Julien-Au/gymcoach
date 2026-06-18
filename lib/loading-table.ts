// Pure percentage-of-e1RM loading table (issue #226).
//
// Many programs (5/3/1, nSuns, the templates we ship) prescribe loads as a
// percentage of a training max, and lifters plan heavy/volume days by
// percentage. Given the best estimated 1RM already computed for an exercise on
// the progress view, this derives a small "% of your best" loading table: a
// row per default percentage, with the load rounded to a loadable increment in
// the user's display unit. It is a pure function, fully unit-tested, and
// display-only: it never creates or mutates a Set.
//
// The e1RM is passed in the user's DISPLAY unit (kg or lb) so the rounded loads
// land on plate jumps the lifter actually uses; the caller converts the
// kg-stored e1RM before calling in here.

import { WeightUnit } from '@/lib/prisma-client';
import { roundWeight } from '@/lib/units';

// Default percentages, heaviest first. A sensible spread for planning heavy and
// volume days off a training max.
export const DEFAULT_LOADING_PERCENTAGES: readonly number[] = [
  95, 90, 85, 80, 75, 70, 65, 60,
];

// Loadable increment per unit: a clean plate jump (2.5 kg / 5 lb), matching the
// warm-up calculator's rounding so the whole page rounds loads consistently.
const LOADING_INCREMENT: Record<WeightUnit, number> = {
  KG: 2.5,
  LB: 5,
};

export interface LoadingRow {
  // The percentage of the best e1RM this row represents (whole percent).
  percent: number;
  // The load in the display unit, rounded to the nearest loadable increment.
  weight: number;
}

// Round a weight to the NEAREST loadable increment for the unit. Unlike the
// warm-up ramp (which rounds down so a warm-up never creeps up), a planned
// working load reads best rounded to the closest plate jump.
function roundToIncrement(weight: number, unit: WeightUnit): number {
  const step = LOADING_INCREMENT[unit];
  return roundWeight(Math.round(weight / step) * step, 2);
}

// Build the loading table from a best estimated 1RM expressed in the display
// unit. Returns an empty list when there is no usable e1RM (zero, negative, or
// non-finite) so the caller can simply hide the table for a new exercise.
export function computeLoadingTable(
  bestE1RM: number,
  unit: WeightUnit,
  percentages: readonly number[] = DEFAULT_LOADING_PERCENTAGES,
): LoadingRow[] {
  if (!Number.isFinite(bestE1RM) || bestE1RM <= 0) return [];
  return percentages.map((percent) => ({
    percent,
    weight: roundToIncrement((bestE1RM * percent) / 100, unit),
  }));
}
