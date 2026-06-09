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
  Upper/Lower): start a program from a template through the same generation path
  the AI uses, then edit it like any program.
- Optional pre-session readiness check-in (overall readiness and sleep quality on
  1-5 scales, plus optional per-muscle-group soreness and a short note): skippable,
  never blocks starting a session, and feeds the AI coach as one more
  auto-regulation signal when it is recent.
- Test pyramid (unit, integration, E2E) with CI running lint, typecheck, unit,
  integration, build, and E2E on every pull request.
- Docker and Docker Compose setup for local development and production.

### Changed

- Migrated the entire codebase (UI, comments, prompts, docs) from French to
  English.
- Grew the autonomous-loop maintenance infrastructure into a full self-maintenance
  pipeline: the green-gate (`scripts/verify.sh`); the `implement-issue`, `triage`,
  `ship-pr`, and `write-up` skills; an autonomy charter with guardrails; and the
  loop playbook in `docs/loops/`.
- Sharpened the AI coach's positioning: it advises within your program rather than
  silently restructuring it, always explains the why behind a suggestion, and
  frames generated programs as editable drafts. The program-adjustment output
  contract is unchanged.

### Fixed

- Mapped the popover color token so dropdown menus render opaque instead of
  transparent.
- Used a literal `DATABASE_URL` in the E2E CI job environment.

[Unreleased]: https://github.com/Julien-Au/gymcoach/commits/main
