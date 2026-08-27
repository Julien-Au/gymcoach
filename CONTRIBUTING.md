# Contributing to GymCoach

Thanks for your interest in improving GymCoach. External issues and pull
requests are welcome and encouraged. This guide covers the local setup, the
checks your changes should pass, and - because this repo is largely maintained
by an autonomous AI loop - an honest description of how your contribution is
handled.

## How your contribution is handled

This project is maintained day to day by an AI agent under a public charter
(`docs/loops/`). So that you know exactly what to expect:

- **An AI reviews your PR; a human merges it.** New external PRs get a triage
  response within about a day and a full structured review verdict within 72
  hours: a mechanical surface check, an adversarial multi-lens code review,
  and a read of CI. The final merge click for new contributors is always made
  by a human maintainer. Contributors with an established track record can be
  granted vetted status, after which green, reviewed PRs may be merged by the
  agent.
- **Your code is executed by CI** (GitHub Actions, ephemeral, no secrets) when
  you open a PR. The maintainers do not run unreviewed external code locally.
- **Some paths are never auto-merged** and always need a human decision:
  CI/workflows, `scripts/`, `.claude/`, build and container files, ignore
  files, dependency manifests and lockfiles, executable configs
  (`next.config.js`, test configs, `middleware.ts`), Prisma schema and
  migrations, auth/session/rate-limit code, the MCP surface, bulk data export
  routes, the LLM provider and prompt layer, locale modules (`messages/`,
  `i18n/`), and the maintenance charter in `docs/loops/`. The authoritative
  list lives in `docs/loops/10-external-contributions.md`. PRs there are
  welcome - just expect a human in the loop and a slower cycle.
- **Feature ideas are welcome as issues.** Clear, in-scope issues may be
  implemented by the agent itself, with credit to you in the PR and CHANGELOG.
- **License and sign-off**: by submitting a contribution you agree it is
  provided under the repository's license. Please add a
  `Signed-off-by: Your Name <email>` line to your commits
  (`git commit -s`, the Developer Certificate of Origin,
  https://developercertificate.org/). This is requested, not yet enforced by
  CI.

None of this is a security guarantee - review reduces risk, it does not
certify code. It is simply the honest description of the pipeline your PR
goes through.

## Development setup

See the README for the full quick start. In short:

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

## Project conventions

- TypeScript strict, no `any` where it can be avoided.
- Validate every API input with Zod.
- Prefer the existing Shadcn UI primitives in `components/ui`.
- The codebase is English-only (UI, comments, prompts, docs).
- Do not use em-dashes or en-dashes; use a regular hyphen.
- Conventional Commits for messages (`feat:`, `fix:`, `chore:`, ...).

## Tests

The project uses a three-tier test setup. Please add or update tests with your
change.

```bash
npm run test              # unit + component (Vitest, jsdom)
npm run test:coverage     # with coverage

# Integration + E2E need the test database:
docker compose -f docker-compose.test.yml up -d
npx prisma migrate deploy   # DATABASE_URL pointing at the test DB (port 5434)
npm run test:integration    # Vitest against real Postgres
npm run build && npm run test:e2e   # Playwright (builds, then drives the app)
docker compose -f docker-compose.test.yml down
```

CI runs lint, typecheck, unit, integration, build and E2E on every pull
request (see `.github/workflows/ci.yml`).

## Before opening a pull request

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Keep pull requests focused and describe the change and how you tested it.
