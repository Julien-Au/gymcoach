import { describe, it, expect } from 'vitest';
import {
  DELOAD_READINESS_LOOKBACK,
  DELOAD_READINESS_MIN_CHECKINS,
  DELOAD_READINESS_THRESHOLD,
  DELOAD_STALLED_LIFTS_MIN,
  deloadReasonLine,
  recommendDeload,
} from './deload';

describe('recommendDeload', () => {
  it('recommends nothing when no lift is stalled and readiness is fine', () => {
    const result = recommendDeload({
      stalledExerciseNames: [],
      recentReadiness: [4, 5, 4, 3, 4],
    });
    expect(result.recommended).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('triggers on enough stalled lifts', () => {
    const result = recommendDeload({
      stalledExerciseNames: ['Bench press', 'Squat'],
      recentReadiness: [4, 4, 4],
    });
    expect(result.recommended).toBe(true);
    expect(result.reasons).toEqual([
      { kind: 'stalled-lifts', exerciseNames: ['Bench press', 'Squat'] },
    ]);
  });

  it('does not trigger below the stalled-lifts minimum', () => {
    const result = recommendDeload({
      stalledExerciseNames: ['Bench press'],
      recentReadiness: [],
    });
    expect(DELOAD_STALLED_LIFTS_MIN).toBeGreaterThan(1);
    expect(result.recommended).toBe(false);
  });

  it('triggers on chronically low readiness', () => {
    const result = recommendDeload({
      stalledExerciseNames: [],
      recentReadiness: [2, 1, 2, 2, 3],
    });
    expect(result.recommended).toBe(true);
    expect(result.reasons).toEqual([
      { kind: 'low-readiness', averageReadiness: 2, checkins: 5 },
    ]);
  });

  it('averages only the most recent lookback window, newest first', () => {
    // Five recent low scores followed by old high ones: the old scores must
    // not dilute the average below the trigger.
    const result = recommendDeload({
      stalledExerciseNames: [],
      recentReadiness: [2, 2, 2, 2, 2, 5, 5, 5, 5],
    });
    expect(result.reasons).toEqual([
      {
        kind: 'low-readiness',
        averageReadiness: 2,
        checkins: DELOAD_READINESS_LOOKBACK,
      },
    ]);
  });

  it('needs a minimum number of check-ins before the readiness trigger fires', () => {
    const tooFew = Array(DELOAD_READINESS_MIN_CHECKINS - 1).fill(1);
    const result = recommendDeload({
      stalledExerciseNames: [],
      recentReadiness: tooFew,
    });
    expect(result.recommended).toBe(false);
  });

  it('does not trigger when the average sits above the threshold', () => {
    // Average 2.6 with threshold 2: close, but recovery is not chronic.
    const result = recommendDeload({
      stalledExerciseNames: [],
      recentReadiness: [3, 2, 3, 2, 3],
    });
    expect(DELOAD_READINESS_THRESHOLD).toBe(2);
    expect(result.recommended).toBe(false);
  });

  it('reports both reasons when both triggers hold', () => {
    const result = recommendDeload({
      stalledExerciseNames: ['Bench press', 'Squat', 'Deadlift'],
      recentReadiness: [1, 2, 2],
    });
    expect(result.recommended).toBe(true);
    expect(result.reasons.map((r) => r.kind)).toEqual([
      'stalled-lifts',
      'low-readiness',
    ]);
  });

  it('rounds the reported average to one decimal', () => {
    const result = recommendDeload({
      stalledExerciseNames: [],
      recentReadiness: [1, 2, 2],
    });
    expect(result.reasons).toEqual([
      { kind: 'low-readiness', averageReadiness: 1.7, checkins: 3 },
    ]);
  });
});

describe('deloadReasonLine', () => {
  it('formats a single stalled lift', () => {
    expect(
      deloadReasonLine({ kind: 'stalled-lifts', exerciseNames: ['Bench'] }),
    ).toBe('1 lift has stalled: Bench.');
  });

  it('formats several stalled lifts', () => {
    expect(
      deloadReasonLine({ kind: 'stalled-lifts', exerciseNames: ['Bench', 'Squat'] }),
    ).toBe('2 lifts have stalled: Bench, Squat.');
  });

  it('formats chronically low readiness', () => {
    expect(
      deloadReasonLine({ kind: 'low-readiness', averageReadiness: 2.3, checkins: 4 }),
    ).toBe('Your readiness has averaged 2.3/5 over your last 4 check-ins.');
  });
});
