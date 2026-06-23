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
- shipped - include cardio duration/distance in the CSV history export (issue #144, 2026-06-12, PR #148) - column order pinned; closes the data-ownership gap
- shipped - dedicated conditioning section in the AI coach payload (issue #145, 2026-06-12, PR #149) - review CLEAN on all seven lenses incl. the two-writers scan
- shipped - supersets slice 1: program-level pairing + A1/A2 session flow (issue #146, 2026-06-12, PR #150) - review CLEAN; E2E proven live; later slices (shared rest, circuits) still un-filed
- shipped - TCX file import (duration/distance/HR) (issue #152, 2026-06-12, PR #158) - hostile security review CLEAN: no entity decoding by construction, adversarial 5MB inputs linear; nits filed as #161
- shipped - per-day conditioning + interference guidance (issue #153, 2026-06-12, PR #157) - review CLEAN; daily window aligned to the strength week at the UTC instant
- shipped - 'What your coach sees' transparency card (issue #154, 2026-06-12, PR #156 + fix #162) - review found the footer overclaimed privacy; reworded to the truth same-day
- rejected - OAuth cloud integrations (Garmin/Strava/Apple Health), watch companion / rep auto-counting, black-box auto-push program generator, nutrition/macro tracking, real-time GPS recorder (2026-06-12 research anti-recommendations) - recorded so future runs never propose them
- shipped - export a cardio session as a TCX file (issue #175, 2026-06-13, PR #181 + hardening #182) - the outbound data-ownership half; hostile review CLEAN (escaping + ownership), round-trips through the parser
- shipped - show last-time cardio performance in the session (issue #176, 2026-06-13, PR #179) - review CLEAN; ungated the cardio branch, HR averaged
- shipped - cardio pace and speed (derived) on the session summary and history (issue #177, 2026-06-13, PR #180) - review CLEAN, math re-derived; warmup-totals inconsistency filed as #183
- shipped - a free-text note to your coach (correctable AI memory) (issue #188, 2026-06-13, PR #194) - multi-lens review CLEAN incl. injection posture (note is JSON data, not instructions; contract byte-identical)
- shipped - supersets slice 2: superset-aware rest timer (issue #189, 2026-06-13, PR #193) - review CLEAN, E2E proven live (short between members, full after group)
- shipped - a Records board (all-time bests per exercise) (issue #190, 2026-06-13, PR #192 + fix #196) - review CLEAN; tie-break date made deterministic
- shipped - body-measurement tracking (waist/arms/etc.) with a trend (issue #202, 2026-06-14, PR #207) - additive BodyMeasurement table; multi-lens review CLEAN (ownership, bounds, migration drift)
- shipped - maximum heart rate on cardio sets (issue #203, 2026-06-14, PR #206) - additive Set.maxHr; review CLEAN (bounds on all writers, Track subtree stripped before lap-max extraction)
- shipped - import a GPX file as a cardio session (issue #204, 2026-06-15, PR #208) - third file format; hostile security review CLEAN (21 adversarial cases, no entity table, linear at 5MB, name never read)
- shipped - free-text (AI-parsed) set logging (issue #210, 2026-06-15, PR #216) - the LAST roadmap item; multi-lens review CLEAN incl. untrusted-output (12 hostile model outputs fail closed, a parse never logs a set)
- shipped - user-settable weekly volume targets (issue #211, 2026-06-15, PR #215) - additive VolumeTarget; review CLEAN (classifyWeeklySets stays pure)
- shipped - give the AI coach your all-time records (issue #212, 2026-06-15, PR #214) - review CLEAN, output contract intact
- shipped - show the exercise's notes/cues in the session set logger (issue #224, 2026-06-16, PR #228 + dedup fix #232) - review CLEAN; the one NIT (cue shown twice) fixed
- shipped - per-muscle weekly training frequency on the progress page (issue #225, 2026-06-16, PR #229) - review CLEAN; distinct-day counting, not set count
- shipped - e1RM-based percentage loading table on the per-exercise progress view (issue #226, 2026-06-16, PR #230) - review CLEAN; converts to display unit before rounding
- shipped - proactive coach insight card on the home dashboard (issue #237, 2026-06-18, PR #240) - pure selector over existing signals (deload > stall > PR > on-track), display-only, no LLM call
- shipped - search/filter box on the exercise catalog (issue #238, 2026-06-18, PR #239) - client-side name filter over the loaded list, no API change
- shipped - import a Garmin FIT file as a cardio session (issue #249, 2026-06-19, PR #251) - the research "killer wedge" (Garmin exports FIT natively); hand-rolled binary decoder of the session-summary message (duration/distance/avg+max HR), reuses the TCX/GPX cardio import pipeline + hostile-input controls; decoder validated against fixtures the official Garmin SDK generated (dev-only, removed after); distinct from the anti-recommended OAuth/cloud Garmin integration
- shipped - import multiple cardio activity files at once, FIT first (issue #253, 2026-06-19, PR pending) - batch array on the FIT route (single `fit` kept backward-compatible), aggregated preview, partial-success confirm; the "rapatrie tout mon historique" flow
- shipped (slices 1+2) - store + chart the detailed pace/HR track of an imported activity (issue #254, 2026-06-19, PR #256) - additive Set.track JSON column, FIT record-message decode downsampled to <=500 points, HR-over-time chart on the history detail. Remaining slice 3 (TCX/GPX point capture) un-filed.
- shipped (GPX slice) - capture the pace/HR track from GPX/TCX imports for the chart (issue #259, 2026-06-23, PR #260) - shared lib/import/track.ts (TrackPoint + cleanTrackPoint + downsampleTrack), FIT refactored onto it, GPX now builds + stores a downsampled track so GPX runs/rides get the HR chart. TCX sub-slice (parse the dropped <Trackpoint> samples) still pending.
