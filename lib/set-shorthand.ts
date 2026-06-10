// Shorthand set parser: lets a lifter type "100x8@9" instead of tabbing
// through separate weight/reps fields (issue #89). Fully deterministic, no
// LLM involved.
//
// Accepted forms (case-insensitive, flexible whitespace):
//   "100x8"      weight x reps
//   "100 x 8"    same, spaced
//   "100 8"      space-separated weight reps
//   "100x8@9"    with an RPE
//   "100 8 9"    space-separated weight reps rpe
//   "62.5x8"     decimal weight
//   "100x8@8.5"  decimal RPE
//
// The weight is a number in the user's DISPLAY unit (kg or lb); callers
// convert with fromDisplayWeight before storing, exactly like the classic
// weight field does.
//
// Out of scope for this slice (deliberately not implemented):
// - bodyweight shorthand ("bw x 10")
// - multi-set shorthand ("3x8x100")
// - any LLM-backed natural-language parsing

export interface ParsedSetShorthand {
  // Weight in the user's display unit (not yet converted to kg).
  weight: number;
  reps: number;
  rpe?: number;
}

// A decimal number like "100", "62.5".
const NUM = String.raw`\d+(?:\.\d+)?`;

// weight ("x" | space) reps [("@" | space) rpe]
// The separator before the RPE is required so e.g. "100 89.5" does not
// backtrack into reps=8, rpe=9.5.
const SHORTHAND_RE = new RegExp(
  String.raw`^(${NUM})\s*(?:x\s*|\s+)(\d+)(?:(?:\s*@\s*|\s+)(${NUM}))?$`,
  'i',
);

// Parse a shorthand set entry. Returns null when the input does not match an
// accepted form, when reps is not a positive integer, or when the RPE is out
// of the 1-10 range.
export function parseSetShorthand(input: string): ParsedSetShorthand | null {
  const match = SHORTHAND_RE.exec(input.trim());
  if (!match) return null;

  const [, weightStr, repsStr, rpeStr] = match;
  if (weightStr === undefined || repsStr === undefined) return null;

  const weight = parseFloat(weightStr);
  const reps = parseInt(repsStr, 10);
  if (!Number.isFinite(weight) || reps < 1) return null;

  if (rpeStr === undefined) {
    return { weight, reps };
  }
  const rpe = parseFloat(rpeStr);
  if (rpe < 1 || rpe > 10) return null;
  return { weight, reps, rpe };
}

// The app tracks effort as RIR (reps in reserve), not RPE. Map a shorthand
// RPE to the RIR stored on the set: RIR = 10 - RPE, rounded to the nearest
// integer and clamped to the API's accepted 0-5 range.
export function rpeToRir(rpe: number): number {
  return Math.min(5, Math.max(0, Math.round(10 - rpe)));
}
