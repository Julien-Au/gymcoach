import { WeightUnit } from '@prisma/client';

// Weight is always stored in kilograms. These helpers convert at the edges only
// (display and form input) so a user can work in pounds without any data
// migration. See issue #1.

// Exact pounds <-> kilograms factor.
export const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

// A stored kg value -> a number in the user's display unit.
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  return unit === 'LB' ? kgToLb(kg) : kg;
}

// A number entered in the user's display unit -> kg for storage.
export function fromDisplayWeight(value: number, unit: WeightUnit): number {
  return unit === 'LB' ? lbToKg(value) : value;
}

// Short label for the unit ("kg" / "lb").
export function unitLabel(unit: WeightUnit): string {
  return unit === 'LB' ? 'lb' : 'kg';
}

// Round to a fixed number of decimals (default 1), dropping floating-point noise.
export function roundWeight(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

interface FormatOptions {
  // Decimal places for the converted value (default 1).
  decimals?: number;
  // Append the unit label (default true).
  withUnit?: boolean;
}

// Format a stored kg value for display in the user's unit, e.g. "70 kg" or
// "154.3 lb". Thousands are grouped; trailing zeros are dropped.
export function formatWeight(
  kg: number,
  unit: WeightUnit,
  opts: FormatOptions = {},
): string {
  const { decimals = 1, withUnit = true } = opts;
  const display = roundWeight(toDisplayWeight(kg, unit), decimals);
  const str = display.toLocaleString('en-US', { maximumFractionDigits: decimals });
  return withUnit ? `${str} ${unitLabel(unit)}` : str;
}

// The set-logger increment in the user's display unit. Internally the app uses
// kg steps (2.5 kg compound / 1 kg isolation); in pounds we use clean plate
// jumps (5 lb / 2.5 lb) rather than awkward converted values.
export function displayIncrement(kgIncrement: number, unit: WeightUnit): number {
  if (unit === 'KG') return kgIncrement;
  return kgIncrement >= 2.5 ? 5 : 2.5;
}
