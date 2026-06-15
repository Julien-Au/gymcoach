import { describe, it, expect } from 'vitest';
import {
  volumeTargetInputSchema,
  volumeTargetClearSchema,
  VOLUME_TARGET_MAX,
} from './volume-target';

describe('volumeTargetInputSchema (issue #211)', () => {
  it('accepts a valid in-range band', () => {
    const parsed = volumeTargetInputSchema.safeParse({
      muscleGroup: 'CHEST',
      mev: 8,
      mrv: 18,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ muscleGroup: 'CHEST', mev: 8, mrv: 18 });
    }
  });

  it('coerces numeric strings', () => {
    const parsed = volumeTargetInputSchema.safeParse({
      muscleGroup: 'QUADS',
      mev: '10',
      mrv: '20',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.mev).toBe(10);
  });

  it('rejects mrv not strictly greater than mev', () => {
    expect(
      volumeTargetInputSchema.safeParse({ muscleGroup: 'CHEST', mev: 12, mrv: 12 })
        .success,
    ).toBe(false);
    expect(
      volumeTargetInputSchema.safeParse({ muscleGroup: 'CHEST', mev: 15, mrv: 10 })
        .success,
    ).toBe(false);
  });

  it('rejects mev below 1 and values above the max', () => {
    expect(
      volumeTargetInputSchema.safeParse({ muscleGroup: 'CHEST', mev: 0, mrv: 10 })
        .success,
    ).toBe(false);
    expect(
      volumeTargetInputSchema.safeParse({
        muscleGroup: 'CHEST',
        mev: 5,
        mrv: VOLUME_TARGET_MAX + 1,
      }).success,
    ).toBe(false);
  });

  it('rejects non-integers and an unknown muscle group', () => {
    expect(
      volumeTargetInputSchema.safeParse({ muscleGroup: 'CHEST', mev: 8.5, mrv: 18 })
        .success,
    ).toBe(false);
    expect(
      volumeTargetInputSchema.safeParse({ muscleGroup: 'NOT_A_GROUP', mev: 8, mrv: 18 })
        .success,
    ).toBe(false);
  });
});

describe('volumeTargetClearSchema', () => {
  it('accepts a known muscle group and rejects an unknown one', () => {
    expect(volumeTargetClearSchema.safeParse({ muscleGroup: 'BICEPS' }).success).toBe(
      true,
    );
    expect(volumeTargetClearSchema.safeParse({ muscleGroup: 'XYZ' }).success).toBe(
      false,
    );
  });
});
