# CLAUDE.md — working agreement for agents on GymCoach

GymCoach is an open source, self-hosted hypertrophy training tracker with a
built-in AI coach. This file tells any Claude Code agent (interactive or inside
a loop) how to work in this repo so it does not have to re-derive conventions.

## What this project is

- **Frontend**: Next.js 14 (App Router), TypeScript strict, Tailwind, Shadcn UI.
- **Backend**: Next.js API routes, Prisma ORM, PostgreSQL 16.
- **AI**: one provider interface in `lib/llm` in front of Anthropic SDK or
  OpenRouter (and a `demo` provider with canned responses, no key).
- **Infra**: Docker / Docker Compose.

## Toolchain (important)

- Requires **Node >= 20**. The system `node` may be too old; the working version
  is **nvm node v22.17.1**. `.claude/settings.local.json` puts it on PATH for
  non-interactive shells, and `scripts/verify.sh` re-exports it. If `npm` is "not
  found", that is why.
- Package manager is **npm**.

## The green-gate (self-verification — never skip)

Before committing or opening a PR, the change MUST pass:

```bash
bash scripts/verify.sh          # prisma generate + lint + typecheck + unit + build
bash scripts/verify.sh --full   # also integration + E2E (needs test Postgres on :5434)
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit, integration, build
and E2E on every PR. The default gate mirrors the fast, DB-free part so a loop
can catch its own regressions locally.

## Code conventions (from CONTRIBUTING.md — enforced)

- TypeScript strict. Avoid `any` where it can be avoided.
- **Validate every API input with Zod** (see `lib/schemas/*`).
- Reuse the existing Shadcn UI primitives in `components/ui`.
- The codebase is **English-only** (UI, comments, prompts, docs).
- **Do not use em-dashes or en-dashes; use a regular hyphen.**
- **Conventional Commits** for messages (`feat:`, `fix:`, `chore:`, `docs:`, ...).
- Keep PRs focused; add or update tests with the change.

## Where things live

- `app/` — pages and API routes (App Router). API routes are `app/api/**/route.ts`.
- `components/` — React components; primitives in `components/ui`.
- `lib/` — helpers: `db`, `auth`, `stats`, `progression`, `llm/`, `schemas/`,
  `prompts/`. Many have colocated `*.test.ts`.
- `prisma/` — schema, migrations, seed.
- `tests/` — integration (Vitest) and E2E (Playwright).
- `docs/loops/` — how this repo is maintained by autonomous loops (the playbook).
- `scripts/verify.sh` — the green-gate.

## AI layer notes

- Pick the provider with `LLM_PROVIDER`. The rest of the app is provider-agnostic.
- Every AI call builds a compact, structured payload (profile + recent sessions +
  active program + per-exercise progression), not raw rows.
- Outputs that touch user data (program changes, generated programs) are
  Zod-validated before being applied.
- The stable system prompt is marked for prompt caching.

## Git / PR etiquette for agents

- Never commit directly to `main`. One branch per task: `fix/issue-<n>-<slug>` or
  `feat/issue-<n>-<slug>`.
- Reference the issue in the PR body with `Closes #<n>`.
- Do not force-push; do not `git reset --hard` shared history (both are denied in
  `.claude/settings.json`).
- Keep the working tree clean before starting a new task.
