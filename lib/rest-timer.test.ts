import { describe, expect, it } from 'vitest';
import {
  REST_ADJUST_STEP_MS,
  adjustRest,
  isRestPaused,
  pauseRest,
  restRemainingMs,
  resumeRest,
} from '@/lib/rest-timer';

const T0 = 1_000_000;
const running = { endsAt: T0 + 90_000, pausedRemainingMs: null };

describe('rest timer clock (issue #393)', () => {
  it('counts down from the wall-clock end while running', () => {
    expect(restRemainingMs(running, T0)).toBe(90_000);
    expect(restRemainingMs(running, T0 + 30_000)).toBe(60_000);
    expect(restRemainingMs(running, T0 + 120_000)).toBe(0);
  });

  it('freezes the remaining time on pause, however long the pause lasts', () => {
    const paused = pauseRest(running, T0 + 10_000);
    expect(isRestPaused(paused)).toBe(true);
    expect(restRemainingMs(paused, T0 + 10_000)).toBe(80_000);
    expect(restRemainingMs(paused, T0 + 600_000)).toBe(80_000);
  });

  it('resumes with exactly the time that was left', () => {
    const paused = pauseRest(running, T0 + 10_000);
    const resumed = resumeRest(paused, T0 + 300_000);
    expect(isRestPaused(resumed)).toBe(false);
    expect(resumed.endsAt).toBe(T0 + 300_000 + 80_000);
    expect(restRemainingMs(resumed, T0 + 300_000)).toBe(80_000);
  });

  it('treats pausing a paused rest and resuming a running one as no-ops', () => {
    const paused = pauseRest(running, T0 + 10_000);
    expect(pauseRest(paused, T0 + 50_000)).toBe(paused);
    expect(resumeRest(running, T0 + 50_000)).toBe(running);
  });

  it('adds and removes 15 s on a running rest', () => {
    const plus = adjustRest(running, REST_ADJUST_STEP_MS, T0 + 30_000);
    expect(restRemainingMs(plus, T0 + 30_000)).toBe(75_000);
    const minus = adjustRest(running, -REST_ADJUST_STEP_MS, T0 + 30_000);
    expect(restRemainingMs(minus, T0 + 30_000)).toBe(45_000);
    expect(isRestPaused(minus)).toBe(false);
  });

  it('adjusts a paused rest without resuming it', () => {
    const paused = pauseRest(running, T0 + 10_000);
    const plus = adjustRest(paused, REST_ADJUST_STEP_MS, T0 + 99_000);
    expect(isRestPaused(plus)).toBe(true);
    expect(restRemainingMs(plus, T0 + 500_000)).toBe(95_000);
  });

  it('never goes below zero when removing more than is left', () => {
    const almostDone = { endsAt: T0 + 5_000, pausedRemainingMs: null };
    const ended = adjustRest(almostDone, -REST_ADJUST_STEP_MS, T0);
    expect(ended.endsAt).toBe(T0);
    expect(restRemainingMs(ended, T0)).toBe(0);

    const paused = pauseRest(almostDone, T0);
    expect(adjustRest(paused, -REST_ADJUST_STEP_MS, T0).pausedRemainingMs).toBe(0);
  });

  it('keeps any extra fields of the caller state', () => {
    const mode = { ...running, kind: 'rest' as const, totalSec: 90 };
    expect(pauseRest(mode, T0)).toMatchObject({ kind: 'rest', totalSec: 90 });
    expect(adjustRest(mode, REST_ADJUST_STEP_MS, T0)).toMatchObject({ kind: 'rest', totalSec: 90 });
  });
});
