import { describe, expect, it } from 'vitest';
import {
  computeLoadingTable,
  DEFAULT_LOADING_PERCENTAGES,
} from './loading-table';

describe('computeLoadingTable (issue #226)', () => {
  it('returns a row per default percentage, heaviest first', () => {
    const rows = computeLoadingTable(100, 'KG');
    expect(rows.map((r) => r.percent)).toEqual([...DEFAULT_LOADING_PERCENTAGES]);
    expect(rows[0]!.percent).toBe(95);
    expect(rows[rows.length - 1]!.percent).toBe(60);
  });

  it('rounds each load to the nearest 2.5 kg in kilograms', () => {
    // 100 kg e1RM: exact multiples of 5 kg for these percentages.
    const rows = computeLoadingTable(100, 'KG');
    const byPercent = Object.fromEntries(rows.map((r) => [r.percent, r.weight]));
    expect(byPercent[95]).toBe(95);
    expect(byPercent[90]).toBe(90);
    expect(byPercent[60]).toBe(60);
  });

  it('rounds to the nearest 2.5 kg increment for non-round e1RMs', () => {
    // 102 kg e1RM: 85% = 86.7 -> nearest 2.5 = 87.5; 70% = 71.4 -> 72.5? no,
    // 71.4 / 2.5 = 28.56 -> round 29 -> 72.5. 65% = 66.3 -> 26.52 -> 27 -> 67.5.
    const rows = computeLoadingTable(102, 'KG');
    const byPercent = Object.fromEntries(rows.map((r) => [r.percent, r.weight]));
    expect(byPercent[85]).toBe(87.5);
    expect(byPercent[70]).toBe(72.5);
    expect(byPercent[65]).toBe(67.5);
    // Every weight is a multiple of 2.5.
    for (const r of rows) {
      expect((r.weight / 2.5) % 1).toBe(0);
    }
  });

  it('rounds to the nearest 5 lb in pounds', () => {
    // e1RM already in the display unit (lb). 225 lb best.
    const rows = computeLoadingTable(225, 'LB');
    const byPercent = Object.fromEntries(rows.map((r) => [r.percent, r.weight]));
    // 90% = 202.5 -> nearest 5 = 200 (202.5/5 = 40.5 -> round 40 -> 200... ties
    // round to even via Math.round: 40.5 -> 41 -> 205). Math.round(40.5)=41.
    expect(byPercent[90]).toBe(205);
    // Every weight is a multiple of 5.
    for (const r of rows) {
      expect((r.weight / 5) % 1).toBe(0);
    }
  });

  it('returns an empty list when there is no usable e1RM', () => {
    expect(computeLoadingTable(0, 'KG')).toEqual([]);
    expect(computeLoadingTable(-10, 'KG')).toEqual([]);
    expect(computeLoadingTable(Number.NaN, 'KG')).toEqual([]);
    expect(computeLoadingTable(Number.POSITIVE_INFINITY, 'LB')).toEqual([]);
  });

  it('accepts a custom percentage set', () => {
    const rows = computeLoadingTable(100, 'KG', [100, 50]);
    expect(rows).toEqual([
      { percent: 100, weight: 100 },
      { percent: 50, weight: 50 },
    ]);
  });
});
