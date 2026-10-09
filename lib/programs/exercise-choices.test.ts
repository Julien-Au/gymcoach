import { describe, expect, it } from 'vitest';
import { workoutExerciseChoices } from '@/lib/programs/exercise-choices';

const catalog = [{ id: 'bench' }, { id: 'row' }, { id: 'squat' }];

describe('workoutExerciseChoices (issue #426)', () => {
  it('hides the exercises the workout already holds', () => {
    expect(workoutExerciseChoices(catalog, ['bench', 'row']).map((e) => e.id)).toEqual(['squat']);
  });

  it('keeps the edited row on its own exercise selectable', () => {
    expect(workoutExerciseChoices(catalog, ['bench', 'row'], 'row').map((e) => e.id)).toEqual([
      'row',
      'squat',
    ]);
  });

  it('offers the whole catalog for an empty workout', () => {
    expect(workoutExerciseChoices(catalog, [])).toEqual(catalog);
  });
});
