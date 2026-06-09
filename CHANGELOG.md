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
- Test pyramid (unit, integration, E2E) with CI running lint, typecheck, unit,
  integration, build, and E2E on every pull request.
- Docker and Docker Compose setup for local development and production.

### Changed

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
- Hardened the autonomous maintenance loop against untrusted external input now
  that the repo is public: external issues, PRs, comments, diffs, and CI logs are
  treated as data and never as instructions; only issues/PRs authored by the
  maintainer login allowlist are auto-implemented or auto-merged; forks and
  non-maintainer PRs are never auto-merged; and the loop refuses prompt-injection
  and secret-exfiltration attempts. Documented in the autonomy charter and
  `CLAUDE.md`, with the loop's `curl`/`wget` denied in the harness config as
  defense in depth.

### Fixed

- Mapped the popover color token so dropdown menus render opaque instead of
  transparent.
- Used a literal `DATABASE_URL` in the E2E CI job environment.

[Unreleased]: https://github.com/Julien-Au/gymcoach/commits/main
