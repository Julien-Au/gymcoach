import { describe, it, expect } from 'vitest';
import { MuscleGroup, ExerciseCategory, EquipmentType } from '@/lib/prisma-client';
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

  // Issue #338: `CatalogExercise` had no `equipmentType`, so every seeded
  // exercise fell to the Prisma default of OTHER — barbell, dumbbell, cable and
  // machine work all read as "Any equipment", and `gymWeightOptions` snapped
  // none of it to a bar or a stack.
  it('every entry declares an explicit, valid equipment type', () => {
    const types = Object.values(EquipmentType);
    for (const e of EXERCISE_CATALOG) {
      expect(e.equipmentType, `${e.name} has no equipment type`).toBeDefined();
      expect(types, `${e.name} has an invalid equipment type`).toContain(e.equipmentType);
    }
  });

  // The bug was every entry landing on one value, so a test that only checked
  // the field exists would have passed against `OTHER` everywhere.
  it('does not fall back to OTHER for the whole catalog', () => {
    const other = EXERCISE_CATALOG.filter((e) => e.equipmentType === EquipmentType.OTHER);
    expect(
      other,
      `OTHER is kept only where it is honest: ${other.map((e) => e.name)}`,
    ).toHaveLength(0);
    expect(new Set(EXERCISE_CATALOG.map((e) => e.equipmentType)).size).toBeGreaterThanOrEqual(5);
  });

  it('the equipment named in an exercise name is the equipment it is typed as', () => {
    const byName: [RegExp, EquipmentType][] = [
      [/^Barbell /i, EquipmentType.BARBELL],
      [/^Dumbbell /i, EquipmentType.DUMBBELL],
      [/^Cable /i, EquipmentType.CABLE],
      [/^Machine /i, EquipmentType.MACHINE],
    ];
    for (const e of EXERCISE_CATALOG) {
      for (const [pattern, expected] of byName) {
        if (pattern.test(e.name)) {
          expect(e.equipmentType, `${e.name} should be ${expected}`).toBe(expected);
        }
      }
    }
  });

  it('cardio entries are typed CARDIO', () => {
    for (const e of EXERCISE_CATALOG) {
      if (e.category === ExerciseCategory.CARDIO) {
        expect(e.equipmentType, `${e.name} is cardio`).toBe(EquipmentType.CARDIO);
      }
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
