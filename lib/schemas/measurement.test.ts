import { describe, it, expect } from 'vitest';
import {
  bodyMeasurementInputSchema,
  bodyMeasurementListQuerySchema,
  MEASUREMENT_MAX_CM,
  MEASUREMENT_MIN_CM,
} from './measurement';

describe('bodyMeasurementInputSchema', () => {
  it('accepts a valid measurement and coerces a numeric string', () => {
    const parsed = bodyMeasurementInputSchema.parse({ site: 'WAIST', valueCm: '82.5' });
    expect(parsed.site).toBe('WAIST');
    expect(parsed.valueCm).toBe(82.5);
  });

  it('accepts an optional note', () => {
    const parsed = bodyMeasurementInputSchema.parse({
      site: 'ARM_LEFT',
      valueCm: 36,
      note: 'flexed',
    });
    expect(parsed.note).toBe('flexed');
  });

  it('rejects an unknown site', () => {
    expect(
      bodyMeasurementInputSchema.safeParse({ site: 'EARLOBE', valueCm: 10 }).success,
    ).toBe(false);
  });

  it('rejects out-of-range values', () => {
    expect(
      bodyMeasurementInputSchema.safeParse({ site: 'WAIST', valueCm: MEASUREMENT_MIN_CM - 1 })
        .success,
    ).toBe(false);
    expect(
      bodyMeasurementInputSchema.safeParse({ site: 'WAIST', valueCm: MEASUREMENT_MAX_CM + 1 })
        .success,
    ).toBe(false);
    expect(bodyMeasurementInputSchema.safeParse({ site: 'WAIST', valueCm: 0 }).success).toBe(
      false,
    );
    expect(bodyMeasurementInputSchema.safeParse({ site: 'WAIST', valueCm: -5 }).success).toBe(
      false,
    );
  });

  it('rejects a missing site', () => {
    expect(bodyMeasurementInputSchema.safeParse({ valueCm: 80 }).success).toBe(false);
  });
});

describe('bodyMeasurementListQuerySchema', () => {
  it('accepts a valid site filter', () => {
    expect(bodyMeasurementListQuerySchema.parse({ site: 'HIPS' }).site).toBe('HIPS');
  });

  it('treats an absent site as "all sites"', () => {
    expect(bodyMeasurementListQuerySchema.parse({}).site).toBeUndefined();
  });

  it('rejects an invalid site (caller falls back to all sites)', () => {
    expect(bodyMeasurementListQuerySchema.safeParse({ site: 'NOPE' }).success).toBe(false);
  });
});
