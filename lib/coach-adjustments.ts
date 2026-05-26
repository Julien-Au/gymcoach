import { z } from 'zod';

// ============================================================
// Ajustements proposés par le coach (LOT 10)
// ============================================================
// Le system prompt demande à Claude d'émettre un bloc XML <adjustments>
// contenant un tableau JSON à la fin de chaque debrief. On extrait, valide
// (Zod) et expose le résultat à l'UI sans toucher au markdown affiché.

export const adjustmentSchema = z.object({
  exerciseName: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(300),
  rationale: z.string().trim().max(800).optional().nullable(),
  suggestedRepsMin: z.number().int().min(1).max(50).optional().nullable(),
  suggestedRepsMax: z.number().int().min(1).max(50).optional().nullable(),
  suggestedSets: z.number().int().min(1).max(20).optional().nullable(),
  suggestedRIR: z.number().int().min(0).max(5).optional().nullable(),
  suggestedRestSec: z.number().int().min(15).max(600).optional().nullable(),
  currentLoad: z.number().min(0).max(1000).optional().nullable(),
  suggestedLoad: z.number().min(0).max(1000).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export type Adjustment = z.infer<typeof adjustmentSchema>;

const ADJUSTMENTS_TAG_RE = /<adjustments>([\s\S]*?)<\/adjustments>/i;

export interface ExtractedAdjustments {
  // Markdown nettoyé du bloc <adjustments> (utilisable directement à l'affichage).
  cleaned: string;
  // Tableau d'ajustements validés. Vide si bloc absent ou invalide.
  adjustments: Adjustment[];
  // Erreurs de parsing remontées pour debug (non bloquantes).
  parseErrors: string[];
}

// Extrait et parse le bloc <adjustments>...</adjustments> d'une réponse coach.
// Retourne le markdown nettoyé + les ajustements valides. En cas d'erreur de
// parsing JSON ou de schéma, on retourne juste un tableau vide et l'erreur
// dans parseErrors (le markdown reste affichable).
export function extractAdjustments(markdown: string): ExtractedAdjustments {
  const match = markdown.match(ADJUSTMENTS_TAG_RE);
  if (!match) {
    return { cleaned: markdown.trim(), adjustments: [], parseErrors: [] };
  }
  const cleaned = markdown.replace(ADJUSTMENTS_TAG_RE, '').trim();
  const raw = match[1]?.trim();
  if (!raw) {
    return { cleaned, adjustments: [], parseErrors: ['Bloc <adjustments> vide.'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      cleaned,
      adjustments: [],
      parseErrors: [
        `JSON invalide dans <adjustments> : ${err instanceof Error ? err.message : 'erreur inconnue'}`,
      ],
    };
  }

  const result = z.array(adjustmentSchema).safeParse(parsed);
  if (!result.success) {
    return {
      cleaned,
      adjustments: [],
      parseErrors: [
        `Schema invalide : ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ')}`,
      ],
    };
  }
  return { cleaned, adjustments: result.data, parseErrors: [] };
}

// ============================================================
// Schema de la requête POST /api/coach/[id]/apply
// ============================================================
// Le client envoie la liste des ajustements validés (potentiellement édités
// par l'utilisateur). On revérifie côté serveur via Zod.

export const applyAdjustmentsSchema = z.object({
  adjustments: z.array(adjustmentSchema).min(1, 'Aucun ajustement à appliquer.'),
});

export type ApplyAdjustmentsInput = z.infer<typeof applyAdjustmentsSchema>;
