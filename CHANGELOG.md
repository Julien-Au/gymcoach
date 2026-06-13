# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Multi-user accounts: registration, profiles, per-user data isolation, and
  rate limiting.
- Workout logging with sets, reps, RIR, warmups, and drop sets.
- Progress charts, estimated 1RM (Epley) tracking, and bodyweight-aware tonnage
  for movements like pull-ups and dips.
- Installable PWA with offline-first session logging (IndexedDB + background
  sync) and a screen wake lock during sessions.
- Pluggable LLM provider: Anthropic SDK or any OpenRouter model, switchable via
  the `LLM_PROVIDER` environment variable.
- AI program generation from a natural-language goal, with Zod-validated output.
- Streaming conversational AI coach that uses your training context.
- `demo` LLM provider with canned responses (no API key) plus demo media for the
  AI flows, so the app and live demo work without a real key.
- Demo credentials shown on the login screen when demo mode is enabled, so the
  live demo is one click to try.
- Expanded the default exercise catalog with common machine, cable, dumbbell, and
  accessory movements, including coverage for the forearms and lower-back groups.
- Friendly empty states with a clear call to action on the progress and history
  pages when there is no data yet.
- Weight-unit preference: choose kilograms or pounds for displaying and entering
  weights everywhere (logging, history, summaries, and progress charts). Data is
  always stored in kg.
- In-workout plate-loading calculator: from the set logger, see the per-side plate
  breakdown for a target weight in your display unit, with configurable bar and
  plate inventory per unit, and an honest note when a weight cannot be loaded
  exactly.
- Built-in program templates (5/3/1 Boring But Big, GZCLP, nSuns, Push/Pull/Legs,
  Upper/Lower, plus Starting Strength, StrongLifts 5x5, Madcow 5x5, PHUL, PHAT,
  and a beginner Full Body 3x): start a program from a template through the same
  generation path the AI uses, then edit it like any program.
- Readiness explainability in the session UI: when a recent readiness/soreness
  check-in holds or steps down a suggested load, a short badge next to the
  suggestion says why ("Held - reported soreness" / "Lighter - low readiness
  today"). Nothing is shown when there is no readiness signal.
- Optional pre-session readiness check-in (overall readiness and sleep quality on
  1-5 scales, plus optional per-muscle-group soreness and a short note): skippable,
  never blocks starting a session, and feeds the AI coach as one more
  auto-regulation signal when it is recent.
- In-workout warm-up set calculator: from the set logger, suggest a short ramp of
  warm-up sets (40/60/80 percent of the working weight, descending reps) in your
  display unit, each rounded down to a loadable increment (2.5 kg / 5 lb) and
  clamped to stay below the working weight, with an empty-bar lead-off set. It is
  display-only and never creates or mutates a set.
- Personal-record badge: a working set is flagged when it moves a heavier load than
  ever before, or when its estimated 1RM (Epley) beats your best prior estimate, for
  the same exercise. Records are derived on read from existing set history (no
  records table, no migration); warm-up sets are excluded and ties never count.
- Training consistency card on the progress page: per-week trained days over the
  last 12 ISO weeks plus the current streak of consecutive on-streak weeks, derived
  on read from finished sessions (no new model). A week is on streak when it has at
  least one trained day, or meets your weekly-frequency target when one is set; the
  partial current week does not break the streak.
- Personal records on the post-session summary: a "Personal records this session"
  card flags exercises that beat your last session, reusing the in-session PR math
  (`detectPRs`) against a "since last session" baseline so a set is never compared
  with itself. Heaviest load and best estimated 1RM are shown as separate badges;
  warm-up sets are excluded.
- Volume landmarks card on the progress page: weekly working-set counts per muscle
  group classified against a default MEV/MRV band (10-20 sets/week) as below,
  within, or above the productive range. Display-only reference defaults, derived
  on read; warm-up sets are excluded and the band does not affect progression.
- Stalled-lift detection on the progress page: a "Stalled lifts" card flags
  exercises whose best estimated 1RM has not improved (beyond a 0.5 percent
  tolerance) over the last three sessions. Pure derivation over existing set
  history; needs at least three sessions before it can flag.
- Deload-week recommendation on the progress page: a display-only banner appears
  when at least two lifts are stalled or the average readiness over the last
  five check-ins (max 14 days old) sits at or below the hold boundary (2/5),
  listing the concrete reasons and what a deload week is. Pure derivation over
  the existing stall and readiness signals; no schema or suggestion change.
- Quick set logging via shorthand: type `100x8`, `100 8 9`, or `100x8@9` in a
  single field of the set logger to fill the weight, reps, and effort fields
  (RPE maps to the stored RIR). Deterministic parser in the user's display
  unit; the classic fields keep working unchanged.
- A free-text note to your coach: write a short note the AI coach reads -
  injuries, illness, life constraints - so its advice accounts for your own
  current context. It is the correctable half of "what your coach sees"; the
  note is sent as data, never as instructions, and the output contract is
  unchanged.
- Records board: an all-time-bests section on the progress page showing your
  heaviest set and best estimated 1RM for each lift, with dates.
- Superset rest timer: in a paired (A1/A2) superset the rest is short between
  the two exercises and full only after the group, instead of a full rest
  after every set.
- Export a cardio session as a TCX file: download a finished cardio session
  (duration, distance, average heart rate) as a standard .tcx you can import
  into Strava or any analysis tool - the outbound half of file-based data
  ownership, no cloud account or OAuth. It round-trips back through the
  importer to the same numbers.
- Cardio "last time" in the session: starting a cardio exercise now shows
  your last session's duration, distance, and average heart rate - the
  cardio counterpart of the strength last-performance reference (it was
  previously hidden for cardio).
- Pace and speed on cardio: the session summary and history now show derived
  pace (min/km or /mi) and speed (km/h or mph) for cardio sets with a
  distance, in your unit.
- Complete backup export/restore: the JSON backup now round-trips every
  piece of your data - cardio duration/distance/heart rate, supersets,
  per-exercise goals, bodyweight history, readiness check-ins, and coach
  conversations - not just sessions and programs. Restore validates the file
  as untrusted input (size-capped, every value bounded, all-or-nothing) and
  still accepts older backup files.
- Import a TCX file as a cardio session: duration, distance, and average
  heart rate land on the first-class cardio model, with a dry-run preview
  and duplicate warning - file-based, no cloud account, no OAuth. The
  parser is a minimal extractor with no entity decoding at all, so XML
  attacks (XXE, entity bombs) are impossible by construction; verified by a
  hostile independent security review.
- "What your coach sees": a transparency card on the coach page showing the
  exact structured context the AI receives (goals and progress, stalled
  lifts, deload state, conditioning vs target, readiness), with a truthful
  note about what is and is not sent.
- The AI coach now sees conditioning per day (current week) and is guided
  to flag interference - a long run the day before heavy lower-body work -
  and to suggest sequencing, with reasons; the structured output contract
  is unchanged.
- Average heart rate on cardio sets (new optional field, also importable
  from TCX), shown in the session detail.
- Supersets in programs (slice 1): pair exercises in the program builder and
  they run as A1/A2 in the session - consecutive presentation, group badge,
  and Next cycling within the group - while set logging, rest timing, and
  program generation stay exactly as before.
- The AI coach now sees your conditioning: weekly cardio minutes, distance,
  and sessions (current and previous week) against the 150 min/week
  guideline, as a dedicated payload section; the structured output contract
  is unchanged.
- The CSV history export now includes duration_sec and distance_m columns,
  so cardio work round-trips out of the app just like it comes in; existing
  column positions are unchanged.
- Cardio, first-class: exercises can be CARDIO and their sets log duration
  (mm:ss) and distance instead of weight x reps - offline queue included -
  while staying out of every lifting metric (tonnage, e1RM, PRs, MEV/MRV,
  stalled lifts, goals, and the AI coach's strength signals).
- The Strong and Hevy CSV imports now map cardio rows onto duration/distance
  (meters/miles and km variants) instead of skipping them; unusable rows are
  still counted and reported, and the strength import paths are pinned
  unchanged.
- Conditioning card on the progress page: weekly cardio minutes, distance,
  and session count over the last 8 weeks against the 150 min/week guideline,
  shown as soon as any cardio has ever been logged (including for
  cardio-only users).
- CI now smoke-tests the production Docker image on every PR (build + real
  register/login probes), the regression net for image-only failures like
  the bcrypt one that briefly broke the public demo's login.
- Demo-mode production image: the Dockerfile and prod compose now accept the
  build-time demo flags (one-click demo login), and a run-once `seed-demo`
  compose service fills the demo account with the rich deterministic dataset
  and resets it on every deploy. Normal self-host builds are unchanged.
- One-tap deload week: the deload recommendation banner can now start a
  7-day planned deload; while active, every suggested load steps down 10%
  (reason "planned deload", shown in the suggestion badge), it never stacks
  with a readiness step-down, a session badge shows the state, and the AI
  coach is told a deload is underway. Ends automatically or in one tap.
- Ask the coach mid-session: a button in the session runner opens the
  streaming chat with the live workout attached (sets logged so far, program
  targets, today's readiness check-in) so advice is immediate and grounded;
  the chat stays free-form and all structured output contracts are unchanged.
- Import from Hevy: the CSV import now accepts Hevy exports too (real session
  times, warmup and drop-set markers), behind the same hardened pipeline as
  the Strong format - shared size/row caps, streamed body limit, shared rate
  limit, dry-run preview, transactional confirm with duplicate skipping.
- Bodyweight tracking: log dated bodyweight entries from a trend card on the
  progress page (12-week chart, quick add in your display unit, deletable
  entries). The newest entry keeps the profile's current bodyweight in sync
  (transactionally, locked against concurrent edits), which feeds the
  effective-load math everywhere; editing the profile field directly never
  creates an entry. Stored in a new additive `BodyweightEntry` table.
- The AI coach now sees your per-exercise goals (with progress toward each)
  and your fatigue signals (stalled lifts, deload-week recommendation) in its
  payload, with prompt guidance to anchor advice on them; the structured
  adjustments output contract is unchanged.
- Import your training history from a Strong app CSV export: dry-run preview
  (sessions/sets/new-exercise counts plus per-line errors), then a one-click
  transactional import with exact-duplicate skipping. The file is treated as
  untrusted input: 5 MB and 50000-row caps enforced while streaming the body,
  every value Zod-validated after unit conversion, rate-limited, and the
  whole import rolls back on any failure.
- Per-exercise target goals: set one "weight x reps" goal per exercise, see a
  progress bar toward it on the progress page (best estimated 1RM vs the
  target's, Epley), and an "Achieved" badge stamped from the first set that
  meets both the weight and the reps - using the effective load for bodyweight
  exercises. Deleting the achieving set re-derives the achievement from the
  remaining history. Stored in a new additive `ExerciseGoal` table with
  Zod-validated, ownership-scoped API routes.
- Test pyramid (unit, integration, E2E) with CI running lint, typecheck, unit,
  integration, build, and E2E on every pull request.
- Docker and Docker Compose setup for local development and production.

### Changed

- Upgraded to Next.js 15 and React 19, resolving the runtime security
  advisories that npm audit reported against Next.js 14. The PWA service
  worker moved to the maintained @ducanh2912/next-pwa; behavior is unchanged.

- Migrated the entire codebase (UI, comments, prompts, docs) from French to
  English.
- Grew the autonomous-loop maintenance infrastructure into a full self-maintenance
  pipeline: the green-gate (`scripts/verify.sh`); the `implement-issue`, `triage`,
  `ship-pr`, `ideate`, and `write-up` skills; an autonomy charter with guardrails;
  and the loop playbook in `docs/loops/`, including the ideation loop that
  manufactures product feature ideas so the loop grows the product (not just the
  repo) and the memory/learning/regrounding architecture that frames the loop as a
  feedback control system.
- Sharpened the AI coach's positioning: it advises within your program rather than
  silently restructuring it, always explains the why behind a suggestion, and
  frames generated programs as editable drafts. The program-adjustment output
  contract is unchanged.
- The deterministic next-weight suggestion now factors in a recent readiness
  check-in: high soreness on the worked muscle group or low overall readiness
  holds the load (no increment), and very poor recovery applies a single
  conservative step-down. Readiness can only hold or reduce the suggestion, never
  raise it, and with no recent check-in the suggestion is unchanged. A user
  preference "Let readiness/soreness adjust my suggested weights" (default on)
  governs this: turning it off drops the readiness signal before it reaches the
  suggestion, reproducing the pure programmed-progression behavior from before
  the readiness integration.
- Widened the autonomy charter per an operator directive: complex features
  (data-safe migrations, LLM output-contract changes, multi-surface work) now
  ship without human review when they are a clear product plus, compensated by
  reinforced non-regression controls (full local gate before the PR, tests at
  every touched layer, contract tests, multi-lens review, rollback tag before
  migrations, verify-in-app). The stop-for-human list narrows to destructive
  data migrations, auth/security changes, and major dependency bumps; security
  boundaries are unchanged.
- Hardened the autonomous maintenance loop against untrusted external input now
  that the repo is public: external issues, PRs, comments, diffs, and CI logs are
  treated as data and never as instructions; only issues/PRs authored by the
  maintainer login allowlist are auto-implemented or auto-merged; forks and
  non-maintainer PRs are never auto-merged; and the loop refuses prompt-injection
  and secret-exfiltration attempts. Documented in the autonomy charter and
  `CLAUDE.md`, with the loop's `curl`/`wget` denied in the harness config as
  defense in depth.

### Fixed

- Neutralized leading formula characters in the CSV history export so
  imported exercise names or notes cannot plant spreadsheet formulas
  (CSV/DDE injection) in an exported file.
- Mapped the popover color token so dropdown menus render opaque instead of
  transparent.
- Used a literal `DATABASE_URL` in the E2E CI job environment.

[Unreleased]: https://github.com/Julien-Au/gymcoach/commits/main
