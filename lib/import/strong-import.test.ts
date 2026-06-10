import { describe, it, expect } from 'vitest';
import {
  buildStrongImportPlan,
  sessionDateFromKey,
  setDuplicateKey,
} from './strong-import';
import type { StrongCsvRow } from './strong-csv';

function row(over: Partial<StrongCsvRow> = {}): StrongCsvRow {
  return {
    dateKey: '2026-05-02',
    workoutName: 'Push',
    exerciseName: 'Bench',
    setOrder: 1,
    weightKg: 80,
    reps: 8,
    ...over,
  };
}

describe('buildStrongImportPlan', () => {
  it('groups rows by (date, workout name) into sessions', () => {
    const plan = buildStrongImportPlan(
      [
        row({ setOrder: 1 }),
        row({ setOrder: 2 }),
        row({ dateKey: '2026-05-03', workoutName: 'Pull', exerciseName: 'Row' }),
        row({ dateKey: '2026-05-02', workoutName: 'Evening', exerciseName: 'Curl' }),
      ],
      [],
      new Set(),
    );
    expect(plan.sessions.map((s) => `${s.dateKey}|${s.workoutName}`)).toEqual([
      '2026-05-02|Push',
      '2026-05-02|Evening',
      '2026-05-03|Pull',
    ]);
    expect(plan.totalSets).toBe(4);
  });

  it('matches existing exercises case-insensitively and lists only missing ones', () => {
    const plan = buildStrongImportPlan(
      [row({ exerciseName: 'bench' }), row({ exerciseName: 'New Lift', setOrder: 2 })],
      ['Bench'],
      new Set(),
    );
    expect(plan.newExerciseNames).toEqual(['New Lift']);
  });

  it('deduplicates new exercise names case-insensitively within the file', () => {
    const plan = buildStrongImportPlan(
      [
        row({ exerciseName: 'New Lift', setOrder: 1 }),
        row({ exerciseName: 'new lift', setOrder: 2 }),
      ],
      [],
      new Set(),
    );
    expect(plan.newExerciseNames).toEqual(['New Lift']);
  });

  it('skips exact duplicates of existing sets and counts them', () => {
    const existing = new Set([setDuplicateKey('2026-05-02', 'Bench', 1, 80, 8)]);
    const plan = buildStrongImportPlan(
      [row({ setOrder: 1 }), row({ setOrder: 2 })],
      ['Bench'],
      existing,
    );
    expect(plan.duplicateCount).toBe(1);
    expect(plan.totalSets).toBe(1);
    expect(plan.sessions[0]?.sets.map((s) => s.setOrder)).toEqual([2]);
  });

  it('skips exact duplicate rows within the file itself', () => {
    const plan = buildStrongImportPlan([row(), row()], [], new Set());
    expect(plan.duplicateCount).toBe(1);
    expect(plan.totalSets).toBe(1);
  });

  it('creates no session when every set of it is a duplicate', () => {
    const existing = new Set([setDuplicateKey('2026-05-02', 'Bench', 1, 80, 8)]);
    const plan = buildStrongImportPlan([row()], ['Bench'], existing);
    expect(plan.sessions).toEqual([]);
    expect(plan.totalSets).toBe(0);
  });
});

describe('sessionDateFromKey', () => {
  it('pins the session to noon UTC of its day', () => {
    expect(sessionDateFromKey('2026-05-02').toISOString()).toBe(
      '2026-05-02T12:00:00.000Z',
    );
  });
});
