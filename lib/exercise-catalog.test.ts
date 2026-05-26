import { describe, it, expect } from 'vitest';
import { EXERCISE_CATALOG } from './exercise-catalog';

describe('EXERCISE_CATALOG', () => {
  it('has unique exercise names', () => {
    const names = EXERCISE_CATALOG.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every entry has a name, a positive rest time, and a muscle group', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(20);
    for (const e of EXERCISE_CATALOG) {
      expect(e.name.trim().length).toBeGreaterThan(0);
      expect(e.defaultRestSec).toBeGreaterThan(0);
      expect(e.muscleGroup).toBeTruthy();
      expect(e.category).toBeTruthy();
    }
  });
});
