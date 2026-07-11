import { BodyMeasurementSite } from '@/lib/prisma-client';

// ============================================================
// Body measurements (issue #202) - pure display helpers
// ============================================================
// Tape-measure tracking, stored always in cm (BodyMeasurement.valueCm). These
// helpers keep the site ordering and human labels in one place so the card,
// the API and any future consumer agree.

// Centimeters per inch, for the imperial display path.
export const CM_PER_INCH = 2.54;

// The sites in the order they appear in the selector (top-down, left/right
// paired). The enum is the source of truth for validity; this is the source of
// truth for presentation order.
export const MEASUREMENT_SITES: BodyMeasurementSite[] = [
  'NECK',
  'SHOULDERS',
  'CHEST',
  'WAIST',
  'HIPS',
  'ARM_LEFT',
  'ARM_RIGHT',
  'FOREARM_LEFT',
  'FOREARM_RIGHT',
  'THIGH_LEFT',
  'THIGH_RIGHT',
  'CALF_LEFT',
  'CALF_RIGHT',
];

// Converts a stored cm value to the display unit. The app's weight unit doubles
// as the length unit: KG -> metric (cm), LB -> imperial (inches), matching how
// bodyweight already keys off User.unit.
export function toDisplayLength(valueCm: number, metric: boolean): number {
  return metric ? valueCm : valueCm / CM_PER_INCH;
}

// Inverse of toDisplayLength: a value typed in the display unit back to cm for
// storage.
export function fromDisplayLength(value: number, metric: boolean): number {
  return metric ? value : value * CM_PER_INCH;
}

// Rounds a length to one decimal for display, trimming trailing zeros.
export function roundLength(value: number): number {
  return Math.round(value * 10) / 10;
}

// Formats a stored cm value for display: "82.5 cm" or "32.5 in".
export function formatLength(valueCm: number, metric: boolean): string {
  const shown = roundLength(toDisplayLength(valueCm, metric));
  return metric ? `${shown} cm` : `${shown} in`;
}
