// User preferences stored locally (not in the DB).
// Everything is single-user, so localStorage is enough. SSR-safe reads.

import { WeightUnit } from '@prisma/client';

const STORAGE_KEY = 'gymcoach.prefs.v1';

export interface UserPreferences {
  vibration: boolean;
  restTimerSound: boolean;
  // Auto-regulation (issue #61). When on (default), a recent readiness/soreness
  // check-in can make the deterministic next-weight suggestion more conservative
  // (hold the load or step it down). When off, readiness is ignored entirely and
  // the suggestion follows pure programmed progression (pre-#55 behavior).
  readinessAutoRegulation: boolean;
  // Plate-loading calculator (issue #39). Bar weight and available plate
  // denominations are stored per unit, since a kg gym and a lb gym stock
  // different plates. Values are in the matching display unit.
  barWeightKg: number;
  barWeightLb: number;
  platesKg: number[];
  platesLb: number[];
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  vibration: true,
  restTimerSound: false,
  readinessAutoRegulation: true,
  barWeightKg: 20,
  barWeightLb: 45,
  platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  platesLb: [45, 35, 25, 10, 5, 2.5],
};

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable: silently accept.
  }
}

// Targeted helpers (read without requiring the full signature).
export function isVibrationEnabled(): boolean {
  return loadPreferences().vibration;
}

export function isRestTimerSoundEnabled(): boolean {
  return loadPreferences().restTimerSound;
}

// Whether a recent readiness/soreness check-in is allowed to adjust the
// deterministic next-weight suggestion (issue #61). Defaults to true.
export function isReadinessAutoRegulationEnabled(): boolean {
  return loadPreferences().readinessAutoRegulation;
}

// The plate-loading config (bar weight + available plates) for the active unit.
export function plateConfigForUnit(unit: WeightUnit): {
  barWeight: number;
  plates: number[];
} {
  const prefs = loadPreferences();
  return unit === 'LB'
    ? { barWeight: prefs.barWeightLb, plates: prefs.platesLb }
    : { barWeight: prefs.barWeightKg, plates: prefs.platesKg };
}
