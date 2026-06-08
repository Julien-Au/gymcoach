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
      expect(covered, `missing exercises for ${group}`).toContain(group);
    }
  });
});
