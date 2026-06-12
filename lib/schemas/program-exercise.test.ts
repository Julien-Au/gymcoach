import { describe, it, expect } from 'vitest';
import { programExerciseInputSchema } from './program-exercise';

describe('programExerciseInputSchema', () => {
  const valid = {
    exerciseId: 'ex1',
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetRIR: 2,
    restSec: 120,
  };

  it('accepts a valid program exercise and coerces numeric strings', () => {
    const parsed = programExerciseInputSchema.parse({ ...valid, targetSets: '4' });
    expect(parsed.targetSets).toBe(4);
  });

  it('allows an equal rep range (min === max)', () => {
    expect(
      programExerciseInputSchema.safeParse({ ...valid, targetRepsMin: 10, targetRepsMax: 10 })
        .success,
    ).toBe(true);
  });

  it('rejects targetRepsMax below targetRepsMin (cross-field refine)', () => {
    const res = programExerciseInputSchema.safeParse({
      ...valid,
      targetRepsMin: 12,
      targetRepsMax: 8,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes('targetRepsMax'))).toBe(true);
    }
  });

  it('enforces bounds on sets, RIR, and rest', () => {
    expect(programExerciseInputSchema.safeParse({ ...valid, targetSets: 21 }).success).toBe(false);
    expect(programExerciseInputSchema.safeParse({ ...valid, targetRIR: 6 }).success).toBe(false);
    expect(programExerciseInputSchema.safeParse({ ...valid, restSec: 14 }).success).toBe(false);
  });

  // Superset pairing (issue #146, slice 1).
  it('accepts a superset group within bounds, null, or absent (distinct states)', () => {
    const withGroup = programExerciseInputSchema.parse({ ...valid, supersetGroup: 3 });
    expect(withGroup.supersetGroup).toBe(3);

    const cleared = programExerciseInputSchema.parse({ ...valid, supersetGroup: null });
    expect(cleared.supersetGroup).toBeNull();

    // Absent stays absent (undefined), so an update can leave it unchanged.
    const absent = programExerciseInputSchema.parse(valid);
    expect(absent.supersetGroup).toBeUndefined();
  });

  it('rejects out-of-bounds or non-integer superset groups', () => {
    expect(programExerciseInputSchema.safeParse({ ...valid, supersetGroup: 0 }).success).toBe(false);
    expect(programExerciseInputSchema.safeParse({ ...valid, supersetGroup: 10 }).success).toBe(false);
    expect(programExerciseInputSchema.safeParse({ ...valid, supersetGroup: 1.5 }).success).toBe(false);
  });
});
