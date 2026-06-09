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
