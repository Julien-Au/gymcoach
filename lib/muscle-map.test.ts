import { describe, expect, it } from 'vitest';
import { MuscleGroup } from '@/lib/prisma-client';
import { WEEKLY_SETS_MEV, WEEKLY_SETS_MRV, resolveVolumeBand } from '@/lib/stats';
import { MUSCLE_REGIONS, buildMuscleMap, muscleHeat } from './muscle-map';

const DEFAULT_BAND = { mev: WEEKLY_SETS_MEV, mrv: WEEKLY_SETS_MRV, custom: false };

describe('muscleHeat', () => {
  it('maps zero sets to none, not low', () => {
    expect(muscleHeat(0, DEFAULT_BAND)).toBe('none');
  });

  it('classifies below, within and above the band', () => {
    expect(muscleHeat(WEEKLY_SETS_MEV - 1, DEFAULT_BAND)).toBe('low');
    expect(muscleHeat(WEEKLY_SETS_MEV, DEFAULT_BAND)).toBe('optimal');
    expect(muscleHeat(WEEKLY_SETS_MRV, DEFAULT_BAND)).toBe('optimal');
    expect(muscleHeat(WEEKLY_SETS_MRV + 1, DEFAULT_BAND)).toBe('high');
  });

  it('honors a personal band', () => {
    const band = resolveVolumeBand('CHEST', { CHEST: { mev: 4, mrv: 8 } });
    expect(muscleHeat(4, band)).toBe('optimal');
    expect(muscleHeat(9, band)).toBe('high');
  });
});

describe('MUSCLE_REGIONS', () => {
  it('maps every muscle group except OTHER to at least one region', () => {
    for (const group of Object.values(MuscleGroup)) {
      const mapping = MUSCLE_REGIONS[group];
      if (group === 'OTHER') {
        expect(mapping).toBeNull();
      } else {
        expect(mapping, group).not.toBeNull();
        expect(mapping!.regionIds.length, group).toBeGreaterThan(0);
      }
    }
  });

  it('uses globally unique region ids', () => {
    const ids = Object.values(MUSCLE_REGIONS)
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .flatMap((m) => [...m.regionIds]);
    expect(new globalThis.Set(ids).size).toBe(ids.length);
  });
});

describe('buildMuscleMap', () => {
  it('paints untrained groups as none and excludes OTHER even with sets', () => {
    const regions = buildMuscleMap({ OTHER: 12 });
    expect(regions.some((r) => (r.group as string) === 'OTHER')).toBe(false);
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.every((r) => r.level === 'none')).toBe(true);
  });

  it('applies a personal target over the default band', () => {
    const regions = buildMuscleMap({ CHEST: 9 }, { CHEST: { mev: 4, mrv: 8 } });
    const chest = regions.filter((r) => r.group === 'CHEST');
    expect(chest).toHaveLength(2);
    expect(chest.every((r) => r.level === 'high' && r.sets === 9)).toBe(true);
    // Without the target, 9 sets sit below the default MEV of 10.
    const defaults = buildMuscleMap({ CHEST: 9 });
    expect(defaults.find((r) => r.group === 'CHEST')?.level).toBe('low');
  });

  it('carries the view of the mapping on every region', () => {
    const byId = new Map(buildMuscleMap({}).map((r) => [r.regionId, r.view]));
    expect(byId.get('chest-left')).toBe('front');
    expect(byId.get('ham-right')).toBe('back');
  });
});
