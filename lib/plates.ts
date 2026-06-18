// Pure plate-loading math for the in-workout calculator (issue #39).
//
// The calculator works entirely in the user's *display* unit (kg or lb),
// because plate inventories are unit-specific: a kg gym stocks 20/15/10/... kg
// plates, a lb gym stocks 45/35/25/... lb plates. The session UI converts the
// kg-stored target weight to the display unit before calling in here.

import { WeightUnit } from '@/lib/prisma-client';

// Standard bar weights per unit (the empty Olympic barbell).
export const DEFAULT_BAR_WEIGHT: Record<WeightUnit, number> = {
  KG: 20,
  LB: 45,
};

// Standard plate inventories per unit, one plate denomination each. These are
// the plates available *per side*; the calculator assumes a symmetric load.
export const DEFAULT_PLATES: Record<WeightUnit, number[]> = {
  KG: [25, 20, 15, 10, 5, 2.5, 1.25],
  LB: [45, 35, 25, 10, 5, 2.5],
};

export interface PlateGroup {
  // The plate denomination (in the display unit).
  plate: number;
  // How many of this plate go on each side.
  count: number;
}

export interface PlateLoad {
  // The bar weight used in the computation.
  barWeight: number;
  // The plates to load on each side, heaviest first.
  perSide: PlateGroup[];
  // The exact weight the plates + bar produce (may be below the target when
  // the remainder cannot be made from the available plates).
  achievedWeight: number;
  // Target minus achieved, in the display unit. 0 when the target is loadable
  // exactly. Positive means some weight could not be loaded.
  remainder: number;
  // True when the target is below the bar, or no full pair of any plate fits.
  // The UI uses this to show "cannot load this exactly".
  exact: boolean;
}

// Round to a small number of decimals to kill floating-point noise from the
// repeated subtraction (e.g. 2.5 + 1.25 sums).
function clean(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// Greedy plate decomposition. Given a target weight (display unit), a bar
// weight, and an available plate set (per side), return the plates to load on
// each side. For the standard kg/lb inventories the denominations are regular
// enough that greedy yields the minimal, gym-intuitive loading. Any weight that
// cannot be made from the available plates is reported as a remainder, so the
// user is never misled into thinking an unloadable target is loadable.
export function computePlateLoad(
  targetWeight: number,
  barWeight: number,
  availablePlates: number[],
): PlateLoad {
  // Plates usable per side: positive, sorted heaviest first.
  const plates = availablePlates
    .filter((p) => p > 0)
    .slice()
    .sort((a, b) => b - a);

  // A non-positive or sub-bar target cannot be loaded with plates.
  if (!Number.isFinite(targetWeight) || targetWeight <= barWeight) {
    const remainder = Number.isFinite(targetWeight)
      ? clean(Math.max(0, targetWeight - barWeight))
      : 0;
    return {
      barWeight,
      perSide: [],
      achievedWeight: barWeight,
      remainder,
      exact: clean(targetWeight) === clean(barWeight),
    };
  }

  // Weight to distribute across both sides.
  let perSideRemaining = clean((targetWeight - barWeight) / 2);
  const perSide: PlateGroup[] = [];

  for (const plate of plates) {
    if (perSideRemaining < plate) continue;
    const count = Math.floor(clean(perSideRemaining / plate));
    if (count > 0) {
      perSide.push({ plate, count });
      perSideRemaining = clean(perSideRemaining - plate * count);
    }
  }

  const loadedPerSide = perSide.reduce((sum, g) => clean(sum + g.plate * g.count), 0);
  const achievedWeight = clean(barWeight + loadedPerSide * 2);
  const remainder = clean(targetWeight - achievedWeight);

  return {
    barWeight,
    perSide,
    achievedWeight,
    remainder,
    exact: remainder === 0,
  };
}
