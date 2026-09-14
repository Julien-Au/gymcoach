import { describe, expect, it } from 'vitest';
import {
  exerciseDetailPath,
  safeSessionReturnPath,
  selectedExerciseIndex,
  sessionExercisePath,
} from './session-exercise-navigation';

const exercises = [
  { id: 'pe-1', exerciseId: 'squat' },
  { id: 'pe-2', exerciseId: 'rear-delt' },
];

describe('live-session exercise navigation', () => {
  it('restores the selected exercise from the session query', () => {
    expect(selectedExerciseIndex(exercises, 'pe-2')).toBe(1);
    expect(selectedExerciseIndex(exercises, 'missing')).toBe(0);
    expect(selectedExerciseIndex(exercises, undefined)).toBe(0);
  });

  it('keys the selection by program row, so a repeated exercise restores the right row', () => {
    const repeated = [
      { id: 'pe-1', exerciseId: 'squat' },
      { id: 'pe-2', exerciseId: 'rear-delt' },
      { id: 'pe-3', exerciseId: 'squat' },
    ];
    expect(selectedExerciseIndex(repeated, 'pe-3')).toBe(2);
    expect(selectedExerciseIndex(repeated, 'pe-1')).toBe(0);
    // The exercise id itself is not a selector.
    expect(selectedExerciseIndex(repeated, 'squat')).toBe(0);
  });

  it('builds an exercise detail round-trip that preserves selection', () => {
    const returnTo = sessionExercisePath('session-1', 'pe-2');
    expect(returnTo).toBe('/session/session-1?programExerciseId=pe-2');
    expect(exerciseDetailPath('rear-delt', returnTo)).toBe(
      '/exercises/rear-delt?returnTo=%2Fsession%2Fsession-1%3FprogramExerciseId%3Dpe-2',
    );
    expect(safeSessionReturnPath(returnTo)).toBe(returnTo);
  });

  it('rejects external and unrelated return paths', () => {
    expect(safeSessionReturnPath('https://example.com/session/session-1')).toBeNull();
    expect(safeSessionReturnPath('//example.com/session/session-1')).toBeNull();
    expect(safeSessionReturnPath('/settings')).toBeNull();
    expect(safeSessionReturnPath('/session/session-1?exerciseId=squat')).toBeNull();
  });
});
