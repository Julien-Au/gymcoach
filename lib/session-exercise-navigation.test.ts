import { describe, expect, it } from 'vitest';
import {
  exerciseDetailPath,
  safeSessionReturnPath,
  selectedExerciseIndex,
  sessionExercisePath,
} from './session-exercise-navigation';

const exercises = [{ exerciseId: 'squat' }, { exerciseId: 'rear-delt' }];

describe('live-session exercise navigation', () => {
  it('restores the selected exercise from the session query', () => {
    expect(selectedExerciseIndex(exercises, 'rear-delt')).toBe(1);
    expect(selectedExerciseIndex(exercises, 'missing')).toBe(0);
    expect(selectedExerciseIndex(exercises, undefined)).toBe(0);
  });

  it('builds an exercise detail round-trip that preserves selection', () => {
    const returnTo = sessionExercisePath('session-1', 'rear-delt');
    expect(returnTo).toBe('/session/session-1?exerciseId=rear-delt');
    expect(exerciseDetailPath('rear-delt', returnTo)).toBe(
      '/exercises/rear-delt?returnTo=%2Fsession%2Fsession-1%3FexerciseId%3Drear-delt',
    );
    expect(safeSessionReturnPath(returnTo)).toBe(returnTo);
  });

  it('rejects external and unrelated return paths', () => {
    expect(safeSessionReturnPath('https://example.com/session/session-1')).toBeNull();
    expect(safeSessionReturnPath('//example.com/session/session-1')).toBeNull();
    expect(safeSessionReturnPath('/settings')).toBeNull();
  });
});
