import { describe, expect, it } from 'vitest';
import type { Exercise, ProgramExercise } from '@prisma/client';
import { suggestNextWeight, weightIncrement } from './progression';

const compoundExo: Exercise = {
  id: 'e1',
  userId: 'u',
  name: 'Squat',
  muscleGroup: 'QUADS',
  category: 'COMPOUND',
  defaultRestSec: 120,
  notes: null,
  usesBodyweight: false,
  createdAt: new Date(),
};

const isolationExo: Exercise = {
  id: 'e2',
  userId: 'u',
  name: 'Curl',
  muscleGroup: 'BICEPS',
  category: 'ISOLATION',
  defaultRestSec: 60,
  notes: null,
  usesBodyweight: false,
  createdAt: new Date(),
};

function makePe(
  exercise: Exercise,
  overrides: Partial<ProgramExercise> = {},
): ProgramExercise & { exercise: Exercise } {
  return {
    id: 'pe',
    workoutId: 'w',
    exerciseId: exercise.id,
    order: 1,
    targetSets: 3,
    targetRepsMin: 6,
    targetRepsMax: 10,
    targetRIR: 2,
    restSec: 120,
    tempo: null,
    notes: null,
    ...overrides,
    exercise,
  };
}

describe('weightIncrement', () => {
  it('returns 2.5 for compound', () => {
    expect(weightIncrement('COMPOUND')).toBe(2.5);
  });
  it('returns 1 for isolation', () => {
    expect(weightIncrement('ISOLATION')).toBe(1);
  });
});

describe('suggestNextWeight', () => {
  it('returns no-history when there are no previous sets', () => {
    const res = suggestNextWeight(makePe(compoundExo), []);
    expect(res).toEqual({ weight: null, reason: 'no-history' });
  });

  it('progresses a compound by +2.5 kg when every working set hit the top of the range', () => {
    const res = suggestNextWeight(makePe(compoundExo), [
      { weight: 80, reps: 10, rir: 2 },
      { weight: 80, reps: 10, rir: 2 },
      { weight: 80, reps: 10, rir: 2 },
    ]);
    expect(res).toMatchObject({
      weight: 82.5,
      reason: 'progression',
      delta: 2.5,
      workingWeight: 80,
      targetRepsMax: 10,
    });
  });

  it('keeps the same load when at least one working set fell short', () => {
    const res = suggestNextWeight(makePe(compoundExo), [
      { weight: 80, reps: 10, rir: 2 },
      { weight: 80, reps: 9, rir: 2 },
      { weight: 80, reps: 10, rir: 2 },
    ]);
    expect(res).toMatchObject({
      weight: 80,
      reason: 'same-as-last',
      workingWeight: 80,
    });
  });

  it('progresses an isolation by +1 kg at the top of the range', () => {
    const res = suggestNextWeight(
      makePe(isolationExo, { targetRepsMin: 8, targetRepsMax: 12 }),
      [
        { weight: 14, reps: 12, rir: 1 },
        { weight: 14, reps: 12, rir: 1 },
        { weight: 14, reps: 12, rir: 1 },
      ],
    );
    expect(res).toMatchObject({ weight: 15, reason: 'progression', delta: 1 });
  });

  it('ignores drop sets (lighter than working weight) when deciding', () => {
    const res = suggestNextWeight(makePe(compoundExo), [
      { weight: 80, reps: 10, rir: 2 },
      { weight: 80, reps: 10, rir: 2 },
      { weight: 80, reps: 10, rir: 2 },
      { weight: 70, reps: 8, rir: 0 },
    ]);
    expect(res).toMatchObject({ weight: 82.5, reason: 'progression' });
  });

  it('still progresses when reps strictly exceed the top of the range', () => {
    const res = suggestNextWeight(makePe(compoundExo), [
      { weight: 80, reps: 11, rir: 1 },
      { weight: 80, reps: 11, rir: 1 },
      { weight: 80, reps: 10, rir: 2 },
    ]);
    expect(res).toMatchObject({ weight: 82.5, reason: 'progression' });
  });

  it('handles bodyweight (0 kg) as a normal working weight', () => {
    const res = suggestNextWeight(
      makePe(isolationExo, { targetRepsMin: 8, targetRepsMax: 12 }),
      [
        { weight: 0, reps: 12, rir: 0 },
        { weight: 0, reps: 12, rir: 0 },
        { weight: 0, reps: 12, rir: 0 },
      ],
    );
    expect(res).toMatchObject({ weight: 1, reason: 'progression', delta: 1 });
  });
});
