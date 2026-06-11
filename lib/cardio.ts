// ============================================================
// Cardio sets (issue #133) - duration/distance helpers
// ============================================================
// A cardio set is a Set row with durationSec != null (and reps = 1,
// weight = 0 by convention - the API normalizes them on write). These
// helpers keep parsing and formatting in one place: the set logger,
// the sets list, the post-session summary and the history page all
// render through them.

// Bounds shared by the Zod schema and the UI: at least 1 second, at
// most 24 hours; distance at most 1000 km (in meters).
export const MAX_DURATION_SEC = 86400;
export const MAX_DISTANCE_M = 1000000;

// True when a set-like record is a cardio set.
export function isCardioSet(set: { durationSec?: number | null }): boolean {
  return set.durationSec != null;
}

// Parses a user-typed duration into seconds. Accepted formats:
//   "mm:ss"    -> minutes and seconds (e.g. "12:30")
//   "h:mm:ss"  -> hours, minutes, seconds (e.g. "1:05:00")
//   "mm"       -> plain minutes (e.g. "45")
// Returns null for anything else (empty, negative, out of bounds).
export function parseDurationToSec(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,3}(:[0-5]?\d){0,2}$/.test(trimmed)) return null;
  const parts = trimmed.split(':').map((p) => parseInt(p, 10));
  let seconds: number;
  if (parts.length === 1) {
    seconds = parts[0]! * 60; // plain minutes
  } else if (parts.length === 2) {
    seconds = parts[0]! * 60 + parts[1]!;
  } else {
    seconds = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  }
  if (seconds < 1 || seconds > MAX_DURATION_SEC) return null;
  return seconds;
}

// Formats a duration in seconds as "m:ss" (or "h:mm:ss" over an hour).
export function formatDuration(durationSec: number): string {
  const total = Math.max(0, Math.round(durationSec));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

// Formats a distance in meters as kilometers with up to 2 decimals
// (trailing zeros trimmed): 2500 -> "2.5 km", 10000 -> "10 km".
export function formatDistance(distanceM: number): string {
  const km = distanceM / 1000;
  const rounded = +km.toFixed(2);
  return `${rounded} km`;
}

// One-line label for a cardio set: "12:30 · 2.5 km" (duration only when
// there is no distance).
export function formatCardioSet(
  durationSec: number,
  distanceM: number | null | undefined,
): string {
  const duration = formatDuration(durationSec);
  if (distanceM != null && distanceM > 0) {
    return `${duration} · ${formatDistance(distanceM)}`;
  }
  return duration;
}
