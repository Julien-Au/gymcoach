import { describe, it, expect } from 'vitest';
import {
  CM_PER_INCH,
  formatLength,
  fromDisplayLength,
  MEASUREMENT_SITES,
  measurementSiteLabel,
  roundLength,
  toDisplayLength,
} from './measurement';

describe('MEASUREMENT_SITES', () => {
  it('lists all 13 enum sites with no duplicates', () => {
    expect(MEASUREMENT_SITES).toHaveLength(13);
    expect(new Set(MEASUREMENT_SITES).size).toBe(13);
  });

  it('has a human label for every site', () => {
    for (const site of MEASUREMENT_SITES) {
      expect(measurementSiteLabel(site)).toBeTruthy();
    }
    expect(measurementSiteLabel('ARM_LEFT')).toBe('Arm (left)');
  });
});

describe('length unit conversion', () => {
  it('is identity in metric', () => {
    expect(toDisplayLength(82.5, true)).toBe(82.5);
    expect(fromDisplayLength(82.5, true)).toBe(82.5);
  });

  it('converts cm <-> inches in imperial', () => {
    expect(toDisplayLength(CM_PER_INCH, false)).toBeCloseTo(1, 6);
    expect(fromDisplayLength(1, false)).toBeCloseTo(CM_PER_INCH, 6);
  });

  it('round-trips a stored value through the display unit', () => {
    const cm = 91.4;
    expect(fromDisplayLength(toDisplayLength(cm, false), false)).toBeCloseTo(cm, 6);
  });
});

describe('formatLength', () => {
  it('renders cm in metric and inches in imperial', () => {
    expect(formatLength(82.5, true)).toBe('82.5 cm');
    // 82.5 cm = 32.48 in -> rounded to 1 decimal.
    expect(formatLength(82.5, false)).toBe('32.5 in');
  });

  it('trims trailing zeros via roundLength', () => {
    expect(roundLength(80.0)).toBe(80);
    expect(formatLength(80, true)).toBe('80 cm');
  });
});
