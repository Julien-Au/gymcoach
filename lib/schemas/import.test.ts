import { describe, it, expect } from 'vitest';
import { strongImportInputSchema } from './import';
import { STRONG_CSV_MAX_BYTES } from '@/lib/import/strong-csv';

describe('strongImportInputSchema', () => {
  it('accepts a csv with a mode and defaults the unit to KG', () => {
    const parsed = strongImportInputSchema.parse({ csv: 'a,b', mode: 'preview' });
    expect(parsed.unit).toBe('KG');
    expect(parsed.mode).toBe('preview');
  });

  it('accepts the LB unit and the confirm mode', () => {
    const parsed = strongImportInputSchema.parse({
      csv: 'a,b',
      unit: 'LB',
      mode: 'confirm',
    });
    expect(parsed.unit).toBe('LB');
    expect(parsed.mode).toBe('confirm');
  });

  it('rejects a missing or empty csv', () => {
    expect(strongImportInputSchema.safeParse({ mode: 'preview' }).success).toBe(false);
    expect(
      strongImportInputSchema.safeParse({ csv: '', mode: 'preview' }).success,
    ).toBe(false);
  });

  it('rejects an oversized csv (5 MB cap)', () => {
    const res = strongImportInputSchema.safeParse({
      csv: 'a'.repeat(STRONG_CSV_MAX_BYTES + 1),
      mode: 'preview',
    });
    expect(res.success).toBe(false);
  });

  it('rejects an unknown mode or unit', () => {
    expect(
      strongImportInputSchema.safeParse({ csv: 'a', mode: 'apply' }).success,
    ).toBe(false);
    expect(
      strongImportInputSchema.safeParse({ csv: 'a', unit: 'ST', mode: 'preview' }).success,
    ).toBe(false);
  });
});
