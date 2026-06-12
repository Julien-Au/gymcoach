# Ideas backlog

Append-only log the `ideate` loop keeps so it never re-proposes a shipped or rejected idea.
One line per idea: `STATUS - title (issue #N, date) - one-line note`. STATUS is
`proposed`, `shipped`, or `rejected`.

Grounding for ideas lives in Memory `research-product-direction.md` (the competitor-review
research and the product wedge). See `docs/loops/08-ideation-loop.md` for how this is used.

## Log

- shipped - warm-up set calculator from the working weight (issue #69, 2026-06-09) - pure lib/warmup.ts + display-only dialog, additive
- shipped - detect personal records (heaviest set + best e1RM) and surface a badge (issue #70, 2026-06-09) - pure lib/records.ts on top of stats e1RM, derived on read, no table
- shipped - training consistency calendar (sessions-per-week + current streak) (issue #71, 2026-06-09) - read-only derivation on the progress page, no new model
- rejected - bodyweight/body-measurement trend (2026-06-09) - needs a non-additive history table; no safe single-PR slice; left for a human
- rejected - supersets/circuits (2026-06-09) - needs a schema change (non-additive)
- rejected - CSV import from Strong/Hevy (2026-06-09) - large parser + untrusted-input handling; bigger than one tight PR
- rejected - e1RM strength trend, per-muscle weekly volume (2026-06-09) - already shipped in lib/stats.ts and on the progress page
- shipped - surface personal records hit during a session on the post-session summary (issue #80, 2026-06-09) - reuse lib/records.ts detectPRs in components/session/session-summary.tsx, additive
- shipped - volume landmarks (MEV/MRV reference bands) on the weekly per-muscle volume chart (issue #81, 2026-06-09) - weekly working-set counts vs default 10/20 sets band in lib/stats.ts, display-only
- shipped - detect stalled lifts (no e1RM progress over recent sessions) and flag them on the progress page (issue #82, 2026-06-09) - pure derivation over exerciseProgress/best1RM, display-only badge
- shipped - recommend a deload week when multiple lifts stall or readiness is chronically low (issue #88, 2026-06-10, PR #93) - pure lib/deload.ts over existing stall + readiness signals, display-only banner
- shipped - quick set logging via shorthand input like 100x8@9 (issue #89, 2026-06-10, PR #94) - deterministic parser lib/set-shorthand.ts, first slice of the roadmap's natural-language set logging, no LLM
- shipped - per-exercise target goals (weight x reps) with progress toward goal (issue #90, 2026-06-10, PR #95 + fix #97) - additive ExerciseGoal table + Zod API + progress bar; first feature shipped under the complex-features directive
- rejected - in-session exercise substitution picker (2026-06-10) - changes what a logged set refers to mid-session; needs a product call on program vs session scope, not a safe default
- shipped - bodyweight tracking (additive BodyweightEntry table + trend card) (issue #99, 2026-06-10, PR #103 + fix #109) - re-evaluated 2026-06-09 rejection; sync race fixed post-merge review
- shipped - import training history from a Strong app CSV export (issue #100, 2026-06-10, PR #105 + hardening #108) - re-evaluated rejection; security review found and fixed body-cap bypass, transaction timeout, CSV formula injection
- shipped - give the AI coach the user's goals and fatigue signals (issue #101, 2026-06-10, PR #104) - payload + prompt input-side only; post-merge review verdict CLEAN
- deferred - supersets/circuits (2026-06-10) - now allowed by the directive (nullable group column is additive) but the session-runner UX surface is too heavy for one tight PR; revisit as its own batch with a UX-first slice
- shipped - ask the coach mid-session with live session context (issue #111, 2026-06-11, PR #116) - post-merge review CLEAN (double ownership gate, contracts byte-identical)
- shipped - start a deload week in one tap from the recommendation (issue #112, 2026-06-11, PR #115) - post-merge review CLEAN; latent negative-weight doc contradiction filed as #118
- shipped - import training history from a Hevy CSV export (issue #113, 2026-06-11, PR #117) - security review CLEAN (shared caps/rate budget verified, Strong path byte-identical)
- shipped - first-class cardio sets (duration/distance + CARDIO category) (issue #133, 2026-06-11, PR #137 + fix #141) - multi-lens review CLEAN; one coach-payload pollution finding fixed same-day
- shipped - importers map cardio rows onto the new fields (issue #134, 2026-06-11, PR #138) - security review CLEAN incl. 8 adversarial probes
- shipped - conditioning card on the progress page (issue #135, 2026-06-11, PR #139) - correctness review CLEAN
- proposed - include cardio duration/distance in the CSV history export (issue #144, 2026-06-12) - data-ownership gap confirmed by the #138 review; two trailing columns, positions pinned
- proposed - dedicated conditioning section in the AI coach payload (issue #145, 2026-06-12) - the deliberate counterpart of the #141 pollution fix; #101 pattern, output contract unchanged
- proposed - supersets slice 1: program-level pairing + A1/A2 session flow (issue #146, 2026-06-12) - the twice-deferred item, finally sliced; logging semantics untouched, later slices for rest/circuit behavior
