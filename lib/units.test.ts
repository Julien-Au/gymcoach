import { describe, it, expect } from 'vitest';
import {
  KG_PER_LB,
  kgToLb,
  lbToKg,
  toDisplayWeight,
  fromDisplayWeight,
  unitLabel,
  roundWeight,
  formatWeight,
  displayIncrement,
} from './units';

describe('units', () => {
  it('converts kg <-> lb with the exact factor', () => {
    expect(kgToLb(KG_PER_LB)).toBeCloseTo(1, 10);
    expect(lbToKg(1)).toBeCloseTo(KG_PER_LB, 10);
    expect(kgToLb(100)).toBeCloseTo(220.462, 3);
    expect(lbToKg(100)).toBeCloseTo(45.359, 3);
  });

  it('round-trips a value through lb and back to kg', () => {
    const kg = 82.5;
    expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 10);
  });

  it('toDisplayWeight / fromDisplayWeight are identity for KG and inverse for LB', () => {
    expect(toDisplayWeight(70, 'KG')).toBe(70);
    expect(fromDisplayWeight(70, 'KG')).toBe(70);
    expect(toDisplayWeight(70, 'LB')).toBeCloseTo(154.324, 3);
    expect(fromDisplayWeight(toDisplayWeight(70, 'LB'), 'LB')).toBeCloseTo(70, 10);
  });

  it('labels the unit', () => {
    expect(unitLabel('KG')).toBe('kg');
    expect(unitLabel('LB')).toBe('lb');
  });

  it('rounds to the requested precision', () => {
    expect(roundWeight(154.3239, 1)).toBe(154.3);
    expect(roundWeight(1234.6, 0)).toBe(1235);
  });

  it('formats stored kg in the user unit', () => {
    expect(formatWeight(70, 'KG')).toBe('70 kg');
    expect(formatWeight(70, 'LB')).toBe('154.3 lb');
    expect(formatWeight(1234.5, 'KG', { decimals: 0 })).toBe('1,235 kg');
    expect(formatWeight(70, 'KG', { withUnit: false })).toBe('70');
  });

  it('uses clean plate jumps for the lb increment', () => {
    expect(displayIncrement(2.5, 'KG')).toBe(2.5);
    expect(displayIncrement(1, 'KG')).toBe(1);
    expect(displayIncrement(2.5, 'LB')).toBe(5);
    expect(displayIncrement(1, 'LB')).toBe(2.5);
  });
});
