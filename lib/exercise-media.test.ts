import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '@/data/exercise-media.json';
import { exerciseMediaCoverage, getExerciseMedia } from './exercise-media';
import { EXERCISE_CATALOG } from './exercise-catalog';
import { exerciseNameDictionaries } from '@/i18n/exercise-names';

describe('exercise media catalog', () => {
  it('covers the default catalog and imported Alpha Progression names', () => {
    const imported = Object.keys(exerciseNameDictionaries.ru ?? {}).filter((name) =>
      name.includes('·'),
    );
    const names = [
      ...EXERCISE_CATALOG.map((exercise) => exercise.name),
      ...imported,
      'Шея зад · Misc',
    ];
    const { missing } = exerciseMediaCoverage(names);
    expect(missing).toEqual([]);
  });

  it('keeps both local frames for every mapped dataset exercise', () => {
    for (const group of catalog.groups) {
      for (const frame of ['0.jpg', '1.jpg']) {
        expect(
          fs.existsSync(
            path.join(
              process.cwd(),
              'public',
              'exercise-media',
              'free-exercise-db',
              group.datasetId,
              frame,
            ),
          ),
        ).toBe(true);
      }
    }
  });

  it('returns null for an unknown custom exercise', () => {
    expect(getExerciseMedia('A future custom movement')).toBeNull();
  });
});
