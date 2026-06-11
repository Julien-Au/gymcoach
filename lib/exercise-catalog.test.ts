import { describe, it, expect } from 'vitest';
import { MuscleGroup, ExerciseCategory } from '@prisma/client';
import { EXERCISE_CATALOG } from './exercise-catalog';

describe('EXERCISE_CATALOG', () => {
  it('has unique exercise names', () => {
    const names = EXERCISE_CATALOG.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every entry has a name, a positive rest time, and a valid muscle group and category', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(20);
    const groups = Object.values(MuscleGroup);
    const categories = Object.values(ExerciseCategory);
    for (const e of EXERCISE_CATALOG) {
      expect(e.name.trim().length).toBeGreaterThan(0);
      expect(e.defaultRestSec).toBeGreaterThan(0);
      expect(groups).toContain(e.muscleGroup);
      expect(categories).toContain(e.category);
    }
  });

  it('covers every muscle group at least once', () => {
    const covered = new Set(EXERCISE_CATALOG.map((e) => e.muscleGroup));
    for (const group of Object.values(MuscleGroup)) {
      // OTHER holds the cardio entries (issue #133) and the fallback bucket
      // for imported exercises (issue #100); coverage is asserted separately.
      if (group === 'OTHER') continue;
      expect(covered, `missing exercises for ${group}`).toContain(group);
    }
  });

  it('includes cardio entries, all grouped under OTHER (issue #133)', () => {
    const cardio = EXERCISE_CATALOG.filter((e) => e.category === ExerciseCategory.CARDIO);
    expect(cardio.length).toBeGreaterThanOrEqual(3);
    expect(cardio.map((e) => e.name)).toContain('Running');
    for (const e of cardio) {
      expect(e.muscleGroup).toBe(MuscleGroup.OTHER);
    }
    // And no non-cardio entry sits in the OTHER bucket.
    for (const e of EXERCISE_CATALOG) {
      if (e.muscleGroup === MuscleGroup.OTHER) {
        expect(e.category).toBe(ExerciseCategory.CARDIO);
      }
    }
  });
});
