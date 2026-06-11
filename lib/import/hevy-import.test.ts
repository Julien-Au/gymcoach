import { describe, it, expect } from 'vitest';
import { buildStrongImportPlan, type NormalizedImportRow } from './strong-import';

// Issue #113: the shared planner carries the Hevy extras (set flags, real
// times) through to the planned sessions. The Strong behavior is pinned by
// strong-import.test.ts, untouched.

function row(over: Partial<NormalizedImportRow> = {}): NormalizedImportRow {
  return {
    dateKey: '2026-05-02',
    workoutName: 'Push',
    exerciseName: 'Bench',
    setOrder: 1,
    weightKg: 80,
    reps: 8,
    isWarmup: false,
    isDropSet: false,
    startedAtIso: '2026-05-02T09:13:00.000Z',
    finishedAtIso: '2026-05-02T10:05:00.000Z',
    ...over,
  };
}

describe('buildStrongImportPlan with normalized Hevy rows', () => {
  it('keeps the warmup/dropset flags on the planned sets', () => {
    const plan = buildStrongImportPlan(
      [
        row({ isWarmup: true, weightKg: 40 }),
        row({ setOrder: 2 }),
        row({ setOrder: 3, isDropSet: true, weightKg: 60 }),
      ],
      [],
      new Set(),
    );
    expect(plan.sessions[0]?.sets.map((s) => [s.isWarmup, s.isDropSet])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
  });

  it('takes the earliest start and the latest end across the session rows', () => {
    const plan = buildStrongImportPlan(
      [
        row({
          setOrder: 1,
          startedAtIso: '2026-05-02T09:20:00.000Z',
          finishedAtIso: '2026-05-02T10:05:00.000Z',
        }),
        row({
          setOrder: 2,
          startedAtIso: '2026-05-02T09:13:00.000Z',
          finishedAtIso: '2026-05-02T10:30:00.000Z',
        }),
      ],
      [],
      new Set(),
    );
    expect(plan.sessions[0]?.startedAtIso).toBe('2026-05-02T09:13:00.000Z');
    expect(plan.sessions[0]?.finishedAtIso).toBe('2026-05-02T10:30:00.000Z');
  });

  it('leaves the times unset for rows without them (Strong rows)', () => {
    const plan = buildStrongImportPlan(
      [row({ startedAtIso: undefined, finishedAtIso: undefined })],
      [],
      new Set(),
    );
    expect(plan.sessions[0]?.startedAtIso).toBeUndefined();
    expect(plan.sessions[0]?.finishedAtIso).toBeUndefined();
  });

  it('a warmup and a working set with identical numbers stay distinct (set order keys them)', () => {
    const plan = buildStrongImportPlan(
      [row({ setOrder: 1, isWarmup: true, weightKg: 60, reps: 8 }), row({ setOrder: 2, weightKg: 60, reps: 8 })],
      [],
      new Set(),
    );
    expect(plan.totalSets).toBe(2);
    expect(plan.duplicateCount).toBe(0);
  });
});
