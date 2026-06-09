import { describe, it, expect } from 'vitest';
import {
  programTemplates,
  getTemplateBySlug,
} from './templates';
import { generatedProgramSchema } from '@/lib/schemas/program-generation';

describe('program templates', () => {
  it('ships at least the four required established programs', () => {
    // Issue #37 asks for 5/3/1, GZCLP, a PPL split and an Upper/Lower split.
    expect(programTemplates.length).toBeGreaterThanOrEqual(4);
    const slugs = programTemplates.map((t) => t.slug);
    expect(slugs).toContain('531-bbb-4day');
    expect(slugs).toContain('gzclp-3day');
    expect(slugs).toContain('ppl-6day');
    expect(slugs).toContain('upper-lower-4day');
  });

  it('has unique slugs', () => {
    const slugs = programTemplates.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every template program validates against the build schema', () => {
    for (const t of programTemplates) {
      const result = generatedProgramSchema.safeParse(t.program);
      expect(result.success, `${t.slug} should be valid`).toBe(true);
    }
  });

  it('every template has display metadata', () => {
    for (const t of programTemplates) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.summary.length).toBeGreaterThan(0);
      expect(t.attribution.length).toBeGreaterThan(0);
    }
  });

  it('every workout has at least one exercise with a valid rep range', () => {
    for (const t of programTemplates) {
      for (const w of t.program.workouts) {
        expect(w.exercises.length).toBeGreaterThan(0);
        for (const ex of w.exercises) {
          expect(ex.targetRepsMax).toBeGreaterThanOrEqual(ex.targetRepsMin);
        }
      }
    }
  });

  it('looks up a template by slug and returns undefined for an unknown slug', () => {
    expect(getTemplateBySlug('ppl-6day')?.name).toBe('Push / Pull / Legs (6-day)');
    expect(getTemplateBySlug('does-not-exist')).toBeUndefined();
  });
});
