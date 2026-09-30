// User preferences stored locally (not in the DB).
// Everything is single-user, so localStorage is enough. SSR-safe reads.

import { WeightUnit } from '@/lib/prisma-client';

const STORAGE_KEY = 'gymcoach.prefs.v1';

export const SET_TABLE_METRICS = ['1RM', '10RM', 'VOLUME'] as const;
export type SetTableMetric = (typeof SET_TABLE_METRICS)[number];

export interface UserPreferences {
  vibration: boolean;
  restTimerSound: boolean;
  // Auto-regulation (issue #61). When on (default), a recent readiness/soreness
  // check-in can make the deterministic next-weight suggestion more conservative
  // (hold the load or step it down). When off, readiness is ignored entirely and
  // the suggestion follows pure programmed progression (pre-#55 behavior).
  readinessAutoRegulation: boolean;
  // Calculated columns shown while logging strength sets. Keep this local-only
  // preference normalized so older/corrupt localStorage cannot break the table.
  setTableMetrics: SetTableMetric[];
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
  setTableMetrics: ['1RM'],
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
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      setTableMetrics: normalizeSetTableMetrics(parsed.setTableMetrics),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...prefs,
        setTableMetrics: normalizeSetTableMetrics(prefs.setTableMetrics),
      }),
    );
  } catch {
    // localStorage unavailable: silently accept.
  }
}

export function normalizeSetTableMetrics(value: unknown): SetTableMetric[] {
  if (!Array.isArray(value)) return [...DEFAULT_PREFERENCES.setTableMetrics];

  const valid = value.filter(
    (metric): metric is SetTableMetric =>
      typeof metric === 'string' && SET_TABLE_METRICS.includes(metric as SetTableMetric),
  );
  const rm = valid.includes('10RM') ? '10RM' : valid.includes('1RM') ? '1RM' : null;
  const volume = valid.includes('VOLUME');

  if (rm) return volume ? [rm, 'VOLUME'] : [rm];
  if (volume) return ['VOLUME'];
  return [...DEFAULT_PREFERENCES.setTableMetrics];
}

export function setTableMetricEnabled(
  current: SetTableMetric[],
  metric: SetTableMetric,
  enabled: boolean,
): SetTableMetric[] {
  const normalized = normalizeSetTableMetrics(current);
  if (!enabled) {
    if (normalized.length === 1 && normalized[0] === metric) return normalized;
    return normalized.filter((value) => value !== metric);
  }

  if (metric === '1RM') return normalized.includes('VOLUME') ? ['1RM', 'VOLUME'] : ['1RM'];
  if (metric === '10RM') return normalized.includes('VOLUME') ? ['10RM', 'VOLUME'] : ['10RM'];
  const rm = normalized.find((value) => value === '1RM' || value === '10RM');
  return rm ? [rm, 'VOLUME'] : ['VOLUME'];
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
