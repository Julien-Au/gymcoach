// Rest timer state transitions (issue #393): pause, resume and +/-15 s.
//
// A running rest is defined by its wall-clock end (`endsAt`), so it survives
// re-renders and tab throttling. A paused rest freezes the time that was left
// (`pausedRemainingMs`); resuming rebuilds `endsAt` from it. Every function is
// pure and takes `now` explicitly so it is testable without fake timers.

export const REST_ADJUST_STEP_MS = 15_000;

export interface RestClock {
  endsAt: number;
  // Milliseconds left when the rest was paused; null while it runs.
  pausedRemainingMs: number | null;
}

export function restRemainingMs(clock: RestClock, now: number): number {
  if (clock.pausedRemainingMs != null) return Math.max(0, clock.pausedRemainingMs);
  return Math.max(0, clock.endsAt - now);
}

export function isRestPaused(clock: RestClock): boolean {
  return clock.pausedRemainingMs != null;
}

export function pauseRest<T extends RestClock>(clock: T, now: number): T {
  if (isRestPaused(clock)) return clock;
  return { ...clock, pausedRemainingMs: restRemainingMs(clock, now) };
}

export function resumeRest<T extends RestClock>(clock: T, now: number): T {
  if (!isRestPaused(clock)) return clock;
  return { ...clock, endsAt: now + restRemainingMs(clock, now), pausedRemainingMs: null };
}

// Adds (positive) or removes (negative) time. The remaining time never drops
// below zero: taking more than is left ends a running rest at once, and leaves
// a paused rest at zero until it is resumed.
export function adjustRest<T extends RestClock>(clock: T, deltaMs: number, now: number): T {
  const remaining = Math.max(0, restRemainingMs(clock, now) + deltaMs);
  if (isRestPaused(clock)) return { ...clock, pausedRemainingMs: remaining };
  return { ...clock, endsAt: now + remaining };
}
