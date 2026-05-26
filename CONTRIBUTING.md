# Contributing to GymCoach

Thanks for your interest in improving GymCoach. This guide covers the local
setup and the checks your changes should pass.

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
