import { READINESS_HOLD_AT_OR_BELOW } from '@/lib/progression';

// ============================================================
// Deload-week recommendation (program-level fatigue signal)
// ============================================================
// lib/progression.ts already deloads a single session's load on a bad
// readiness check-in; this module aggregates the program-level signals
// (several stalled lifts, chronically low readiness) into one display-only
// recommendation to take a deload week. Pure derivation - no clock, no DB.

// How many stalled lifts (per lib/stats.ts isStalled) it takes to read the
// plateau as systemic fatigue rather than a single lift needing a tweak.
export const DELOAD_STALLED_LIFTS_MIN = 2;

// How many of the most recent readiness check-ins the chronic-fatigue test
// averages over.
export const DELOAD_READINESS_LOOKBACK = 5;

// Minimum number of check-ins in the window before the readiness trigger can
// fire. One bad morning is noise; a short consistent run of low scores is not.
export const DELOAD_READINESS_MIN_CHECKINS = 3;

// Check-ins older than this are dead data for a "chronic, current" fatigue
// signal: the caller must not feed them in. Two weeks keeps the trigger about
// the present block, mirroring how lib/progression.ts bounds a single
// check-in's relevance with READINESS_RECENCY_HOURS.
export const DELOAD_READINESS_MAX_AGE_DAYS = 14;

// Average readiness (1 drained - 5 primed) at or below which recovery counts
// as chronically poor. Reuses the per-session "hold the load" boundary from
// lib/progression.ts: scores that hold a single session, sustained across the
// window, justify a planned week of reduced load instead.
export const DELOAD_READINESS_THRESHOLD = READINESS_HOLD_AT_OR_BELOW;

export type DeloadReason =
  | { kind: 'stalled-lifts'; exerciseNames: string[] }
  | { kind: 'low-readiness'; averageReadiness: number; checkins: number };

export interface DeloadRecommendation {
  recommended: boolean;
  reasons: DeloadReason[];
}

export interface DeloadInput {
  // Names of the lifts currently flagged by isStalled, any order.
  stalledExerciseNames: string[];
  // Readiness scores (1-5) of the user's most recent check-ins, newest first.
  // The caller passes whatever it has; only the first
  // DELOAD_READINESS_LOOKBACK entries are considered.
  recentReadiness: number[];
}

// Recommends a deload week when EITHER enough lifts are stalled OR the recent
// readiness average is chronically low. Both reasons are reported when both
// hold, so the UI can explain the full picture.
export function recommendDeload(input: DeloadInput): DeloadRecommendation {
  const reasons: DeloadReason[] = [];

  if (input.stalledExerciseNames.length >= DELOAD_STALLED_LIFTS_MIN) {
    reasons.push({
      kind: 'stalled-lifts',
      exerciseNames: [...input.stalledExerciseNames],
    });
  }

  const window = input.recentReadiness.slice(0, DELOAD_READINESS_LOOKBACK);
  if (window.length >= DELOAD_READINESS_MIN_CHECKINS) {
    const average = window.reduce((acc, r) => acc + r, 0) / window.length;
    if (average <= DELOAD_READINESS_THRESHOLD) {
      reasons.push({
        kind: 'low-readiness',
        averageReadiness: +average.toFixed(1),
        checkins: window.length,
      });
    }
  }

  return { recommended: reasons.length > 0, reasons };
}
