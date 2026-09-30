import { describe, it, expect } from 'vitest';
import {
  computeBestPlateLoad,
  computePlateLoad,
  DEFAULT_BAR_WEIGHT,
  DEFAULT_PLATES,
} from './plates';

describe('computePlateLoad', () => {
  const KG = DEFAULT_PLATES.KG;
  const LB = DEFAULT_PLATES.LB;

  it('loads a clean kg target exactly (100 kg on a 20 kg bar)', () => {
    const load = computePlateLoad(100, 20, KG);
    // 40 kg per side -> 1x25 + 1x15, or 2x20? greedy: 25, then 15.
    expect(load.exact).toBe(true);
    expect(load.remainder).toBe(0);
    expect(load.achievedWeight).toBe(100);
    expect(load.perSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 15, count: 1 },
    ]);
  });

  it('uses multiple plates of the same denomination', () => {
    // 140 kg, 20 bar -> 60 per side -> 2x25 + 1x10
    const load = computePlateLoad(140, 20, KG);
    expect(load.exact).toBe(true);
    expect(load.perSide).toEqual([
      { plate: 25, count: 2 },
      { plate: 10, count: 1 },
    ]);
  });

  it('loads a clean lb target exactly (135 lb on a 45 lb bar)', () => {
    const load = computePlateLoad(135, 45, LB);
    // 45 per side -> 1x45
    expect(load.exact).toBe(true);
    expect(load.achievedWeight).toBe(135);
    expect(load.perSide).toEqual([{ plate: 45, count: 1 }]);
  });

  it('loads 225 lb (a classic plate-math case)', () => {
    const load = computePlateLoad(225, 45, LB);
    // 90 per side -> 2x45
    expect(load.exact).toBe(true);
    expect(load.perSide).toEqual([{ plate: 45, count: 2 }]);
  });

  it('reports a remainder when the target is not exactly loadable', () => {
    // 101 kg, 20 bar -> 40.5 per side; smallest plate is 1.25.
    // greedy: 25 + 15 = 40, leaving 0.5 unloadable.
    const load = computePlateLoad(101, 20, KG);
    expect(load.exact).toBe(false);
    expect(load.achievedWeight).toBe(100);
    expect(load.remainder).toBe(1); // 0.5 per side -> 1 total
  });

  it('returns just the bar when the target equals the bar', () => {
    const load = computePlateLoad(20, 20, KG);
    expect(load.exact).toBe(true);
    expect(load.perSide).toEqual([]);
    expect(load.remainder).toBe(0);
  });

  it('handles a target below the bar gracefully', () => {
    const load = computePlateLoad(15, 20, KG);
    expect(load.exact).toBe(false);
    expect(load.perSide).toEqual([]);
    expect(load.achievedWeight).toBe(20);
    // remainder is clamped to 0 below the bar (you cannot remove bar weight).
    expect(load.remainder).toBe(0);
  });

  it('handles a non-finite target without throwing', () => {
    const load = computePlateLoad(NaN, 20, KG);
    expect(load.perSide).toEqual([]);
    expect(load.exact).toBe(false);
  });

  it('ignores non-positive plate denominations', () => {
    const load = computePlateLoad(100, 20, [25, 0, -5, 15]);
    expect(load.perSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 15, count: 1 },
    ]);
  });

  it('does not accumulate floating-point noise across 2.5/1.25 plates', () => {
    // 47.5 kg, 20 bar -> 13.75 per side -> 10 + 2.5 + 1.25
    const load = computePlateLoad(47.5, 20, KG);
    expect(load.exact).toBe(true);
    expect(load.remainder).toBe(0);
    expect(load.perSide).toEqual([
      { plate: 10, count: 1 },
      { plate: 2.5, count: 1 },
      { plate: 1.25, count: 1 },
    ]);
  });

  it('chooses the bar that loads a target exactly when multiple bars are available', () => {
    const load = computeBestPlateLoad(70, [15, 20], [20, 5], 20);

    expect(load.exact).toBe(true);
    expect(load.barWeight).toBe(20);
    expect(load.achievedWeight).toBe(70);
    expect(load.perSide).toEqual([
      { plate: 20, count: 1 },
      { plate: 5, count: 1 },
    ]);
  });

  it('falls back to the configured bar when no valid gym bars are available', () => {
    const load = computeBestPlateLoad(60, [], [20, 10, 5], 20);

    expect(load.barWeight).toBe(20);
    expect(load.exact).toBe(true);
    expect(load.perSide).toEqual([{ plate: 20, count: 1 }]);
  });

  it('chooses the closest achievable bar when every bar is heavier than the target', () => {
    const load = computeBestPlateLoad(10, [20, 30], [5], 20);

    expect(load.exact).toBe(false);
    expect(load.barWeight).toBe(20);
    expect(load.achievedWeight).toBe(20);
  });

  it('prefers a lighter bar that under-loads slightly over a heavier bar that overshoots', () => {
    // 15 kg bar + 0 plates = 15 (1 under); 20 kg bar = 20 (4 over). A bar above
    // the target has remainder 0, so ranking on the remainder alone picked 20.
    const load = computeBestPlateLoad(16, [15, 20], [1.25], 20);

    expect(load.barWeight).toBe(15);
    expect(load.achievedWeight).toBe(15);
    expect(load.remainder).toBe(1);
    expect(load.exact).toBe(false);
  });

  it('still takes the heavier bar when its overshoot is the smaller miss', () => {
    // 15 kg bar = 15 (4 under); 20 kg bar = 20 (1 over).
    const load = computeBestPlateLoad(19, [15, 20], [5], 20);

    expect(load.barWeight).toBe(20);
    expect(load.achievedWeight).toBe(20);
  });

  it('prefers reaching the target over under-loading when both miss by the same amount', () => {
    // 15 kg bar = 15 (2.5 under); 20 kg bar = 20 (2.5 over).
    const load = computeBestPlateLoad(17.5, [15, 20], [5], 20);

    expect(load.barWeight).toBe(20);
    expect(load.achievedWeight).toBe(20);
  });

  it('breaks a tie between equally close loads with the lighter bar', () => {
    // Both bars reach 60 exactly: 10 + 2x25 and 20 + 2x20.
    const exactTie = computeBestPlateLoad(60, [20, 10], [25, 20], 20);
    expect(exactTie.exact).toBe(true);
    expect(exactTie.barWeight).toBe(10);

    // Both bars stop at 60, 1 short of the target.
    const inexactTie = computeBestPlateLoad(61, [20, 10], [25, 20], 20);
    expect(inexactTie.exact).toBe(false);
    expect(inexactTie.achievedWeight).toBe(60);
    expect(inexactTie.barWeight).toBe(10);
  });

  it('ignores non-finite, zero and negative bars', () => {
    const load = computeBestPlateLoad(60, [NaN, 0, -20, Infinity, 20], [20], 45);

    expect(load.barWeight).toBe(20);
    expect(load.exact).toBe(true);
    expect(load.perSide).toEqual([{ plate: 20, count: 1 }]);
  });

  it('falls back to the configured bar when every gym bar is unusable', () => {
    const load = computeBestPlateLoad(60, [NaN, 0, -20], [20], 20);

    expect(load.barWeight).toBe(20);
    expect(load.achievedWeight).toBe(60);
  });

  it('exposes sensible defaults per unit', () => {
    expect(DEFAULT_BAR_WEIGHT.KG).toBe(20);
    expect(DEFAULT_BAR_WEIGHT.LB).toBe(45);
    expect(DEFAULT_PLATES.KG[0]).toBeGreaterThan(DEFAULT_PLATES.KG.at(-1)!);
  });
});
