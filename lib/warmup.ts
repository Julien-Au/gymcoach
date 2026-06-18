// Pure warm-up ramp math for the in-workout calculator (issue #69).
//
// Given a working weight, this suggests a short ramp of warm-up sets at
// ascending percentages of that weight with descending reps, so a lifter eases
// up to a heavy top set instead of jumping straight onto it. Like the plate
// calculator (lib/plates.ts), it is a pure function with exported types and is
// fully unit-tested. It is display-only: it never creates or mutates a Set.
//
// The ramp is computed in the user's *display* unit (kg or lb) so the suggested
// weights round to a loadable increment in that unit. The session UI converts
// the kg-stored working weight to the display unit before calling in here.

import { WeightUnit } from '@/lib/prisma-client';
import { roundWeight } from '@/lib/units';

// One step of the ramp: a fraction of the working weight and the reps to do at
// it. Fractions ascend, reps descend - a standard hypertrophy/strength warm-up.
interface RampStage {
  // Fraction of the working weight (0..1). The empty-bar stage uses 0 and is
  // handled separately so it is only shown when the bar is below the first
  // percentage stage.
  fraction: number;
  reps: number;
}

// The percentage stages of the ramp, lightest first. Kept small and standard:
// 40% x 5, 60% x 3, 80% x 2 up to the working set.
const RAMP_STAGES: readonly RampStage[] = [
  { fraction: 0.4, reps: 5 },
  { fraction: 0.6, reps: 3 },
  { fraction: 0.8, reps: 2 },
];

// The lightest stage's fraction, used to decide whether the empty bar leads off
// the ramp. Kept as a named constant so the empty-bar check does not index into
// RAMP_STAGES (which the strict-mode noUncheckedIndexedAccess would widen).
const FIRST_STAGE_FRACTION = 0.4;

export interface WarmupSet {
  // The suggested warm-up weight in the display unit, rounded to a loadable
  // increment and never above the working weight.
  weight: number;
  // Suggested reps for this warm-up set.
  reps: number;
  // The actual share of the working weight this set represents, as a whole
  // percent (for display, e.g. "40%"). Computed from the rounded weight so it
  // stays truthful even when a stage clamped to the bar.
  percent: number;
}

export interface WarmupRamp {
  // The working weight the ramp was built from, in the display unit.
  workingWeight: number;
  // The bar weight used as the floor of the ramp, in the display unit.
  barWeight: number;
  // The warm-up sets, lightest first. Empty when there is nothing sensible to
  // suggest (zero/negative working weight, or working weight at/below the bar).
  sets: WarmupSet[];
}

// Standard increment to round warm-up weights to, per unit. A warm-up does not
// need to be loaded as precisely as a working set, so we round to a clean plate
// jump (2.5 kg / 5 lb) - landing on plates the lifter actually has, without the
// fiddly micro-plates a true working weight might need.
const WARMUP_INCREMENT: Record<WeightUnit, number> = {
  KG: 2.5,
  LB: 5,
};

// Round a weight down to the nearest loadable increment for the unit. Rounding
// down (not nearest) guarantees a warm-up never creeps above its target stage.
function roundToIncrement(weight: number, unit: WeightUnit): number {
  const step = WARMUP_INCREMENT[unit];
  return roundWeight(Math.floor(weight / step) * step, 2);
}

// Build a warm-up ramp for a working weight expressed in the display unit.
//
// - Empty/zero/negative or non-finite working weight -> empty ramp (no crash).
// - Working weight at or below the bar -> empty ramp (nothing to warm up to;
//   the bar itself is the load).
// - Otherwise: an empty-bar set, then the percentage stages, each rounded down
//   to a loadable increment, clamped to never exceed the working weight, and
//   de-duplicated so two stages that round to the same weight are not repeated.
export function computeWarmupRamp(
  workingWeight: number,
  unit: WeightUnit,
  barWeight: number,
): WarmupRamp {
  const result: WarmupRamp = { workingWeight, barWeight, sets: [] };

  if (!Number.isFinite(workingWeight) || workingWeight <= 0) return result;
  if (!Number.isFinite(barWeight) || barWeight < 0) return result;
  // At/below the bar there is no ramp to build - the bar is already the load.
  if (workingWeight <= barWeight) return result;

  const sets: WarmupSet[] = [];

  // Start with the empty bar when the bar is below the lightest percentage
  // stage (the usual case): it is the natural first warm-up.
  const firstStageWeight = workingWeight * FIRST_STAGE_FRACTION;
  if (barWeight > 0 && barWeight < firstStageWeight) {
    sets.push({
      weight: roundWeight(barWeight, 2),
      reps: 8,
      percent: Math.round((barWeight / workingWeight) * 100),
    });
  }

  for (const stage of RAMP_STAGES) {
    let weight = roundToIncrement(workingWeight * stage.fraction, unit);
    // Never exceed the working weight; never drop below the bar.
    if (weight > workingWeight) weight = roundToIncrement(workingWeight, unit);
    if (weight < barWeight) weight = roundWeight(barWeight, 2);

    // Skip a stage that rounds to the working weight (that is the working set,
    // not a warm-up) or that duplicates the previous stage's weight.
    if (weight >= workingWeight) continue;
    const previous = sets[sets.length - 1];
    if (previous && previous.weight === weight) continue;

    sets.push({
      weight,
      reps: stage.reps,
      // Percent reflects the actual (rounded/clamped) weight, not the nominal
      // stage fraction, so a stage that clamped up to the bar is labeled with
      // its true share of the working weight rather than a misleading 40/60/80.
      percent: Math.round((weight / workingWeight) * 100),
    });
  }

  result.sets = sets;
  return result;
}
