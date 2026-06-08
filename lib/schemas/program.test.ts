import { describe, it, expect } from 'vitest';
import { programInputSchema } from './program';

describe('programInputSchema', () => {
  it('accepts a valid program and trims fields', () => {
    const parsed = programInputSchema.parse({
      name: '  Upper/Lower  ',
      phase: '  Hypertrophy  ',
      description: '  4-week block  ',
    });
    expect(parsed.name).toBe('Upper/Lower');
    expect(parsed.phase).toBe('Hypertrophy');
    expect(parsed.description).toBe('4-week block');
  });

  it('treats description as optional', () => {
    expect(programInputSchema.safeParse({ name: 'PPL', phase: 'Base' }).success).toBe(true);
  });

  it('requires name and phase', () => {
    expect(programInputSchema.safeParse({ name: '', phase: 'Base' }).success).toBe(false);
    expect(programInputSchema.safeParse({ name: 'PPL', phase: '' }).success).toBe(false);
  });

  it('rejects an over-long name', () => {
    expect(programInputSchema.safeParse({ name: 'x'.repeat(121), phase: 'Base' }).success).toBe(
      false,
    );
  });
});
