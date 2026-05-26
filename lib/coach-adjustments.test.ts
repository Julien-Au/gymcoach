import { describe, expect, it } from 'vitest';
import { extractAdjustments } from './coach-adjustments';

describe('extractAdjustments', () => {
  it('returns the original markdown when no tag is present', () => {
    const md = '## Récap\n\nBon volume cette semaine.';
    const r = extractAdjustments(md);
    expect(r.cleaned).toBe(md);
    expect(r.adjustments).toEqual([]);
    expect(r.parseErrors).toEqual([]);
  });

  it('strips the adjustments block and parses a valid array', () => {
    const md = `## Récap

Belle progression au squat.

<adjustments>
[
  {
    "exerciseName": "Squat",
    "summary": "Monte à 82.5 kg",
    "suggestedLoad": 82.5,
    "currentLoad": 80
  },
  {
    "exerciseName": "Curl barre",
    "summary": "Réduis la fourchette à 8-12",
    "suggestedRepsMin": 8,
    "suggestedRepsMax": 12,
    "rationale": "Tu butes sur 12 reps depuis 3 semaines."
  }
]
</adjustments>`;
    const r = extractAdjustments(md);
    expect(r.cleaned).not.toContain('<adjustments>');
    expect(r.cleaned).toContain('## Récap');
    expect(r.adjustments).toHaveLength(2);
    expect(r.adjustments[0]).toMatchObject({
      exerciseName: 'Squat',
      summary: 'Monte à 82.5 kg',
      suggestedLoad: 82.5,
    });
    expect(r.adjustments[1]?.suggestedRepsMin).toBe(8);
    expect(r.parseErrors).toEqual([]);
  });

  it('returns parseErrors when JSON is malformed (markdown still cleaned)', () => {
    const md = `Du texte
<adjustments>
[ { "exerciseName": "Squat" }
</adjustments>`;
    const r = extractAdjustments(md);
    expect(r.cleaned).toBe('Du texte');
    expect(r.adjustments).toEqual([]);
    expect(r.parseErrors[0]).toMatch(/JSON invalide/);
  });

  it('returns parseErrors when schema validation fails', () => {
    const md = `Texte
<adjustments>
[
  { "exerciseName": "", "summary": "vide" }
]
</adjustments>`;
    const r = extractAdjustments(md);
    expect(r.adjustments).toEqual([]);
    expect(r.parseErrors[0]).toMatch(/Schema invalide/);
  });

  it('handles an empty adjustments tag', () => {
    const md = `Texte\n<adjustments></adjustments>`;
    const r = extractAdjustments(md);
    expect(r.adjustments).toEqual([]);
    expect(r.parseErrors[0]).toMatch(/vide/);
  });

  it('clamps RIR and reps to the documented bounds', () => {
    const md = `<adjustments>
[
  { "exerciseName": "Squat", "summary": "x", "suggestedRIR": 9 }
]
</adjustments>`;
    const r = extractAdjustments(md);
    expect(r.adjustments).toEqual([]);
    expect(r.parseErrors).toHaveLength(1);
  });
});
