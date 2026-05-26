# GymCoach

Open source, self hosted hypertrophy training tracker with a built in AI coach. Log your sessions, track your progress, and get evidence based weekly debriefs and program suggestions from the LLM of your choice (Anthropic Claude or any OpenRouter model).

> Status: actively developed. Multi-user, provider-agnostic (Anthropic or
> OpenRouter), with a unit / integration / E2E test suite and deep AI
> integration.

## Features

- Multi-user accounts: sign up, profiles, per-user data isolation
- Workout logging with sets, reps, RIR, warmups and drop sets
- Progress charts and estimated 1RM tracking
- Bodyweight-aware tonnage (pull-ups, dips, etc.)
- AI coach: weekly debrief and assisted program adjustments
- Conversational AI coach: streaming chat grounded in your training data
- AI program generation from a natural-language goal, editable before saving
- Pluggable LLM provider: Anthropic SDK or any OpenRouter model
- Installable PWA with offline session logging

## Stack

- Frontend: Next.js 14 (App Router), TypeScript strict, Tailwind CSS, Shadcn UI
- Backend: Next.js API routes, Prisma ORM, PostgreSQL 16
- AI: pluggable LLM provider (Anthropic SDK or OpenRouter)
- Infra: Docker and Docker Compose

## Requirements

- Node.js 20+
- Docker and Docker Compose
- npm

## Quick start (local dev)

Recommended setup: Postgres in Docker, Next.js running locally for hot reload.

```bash
# 1. Environment variables
cp .env.example .env
# Edit .env (the example ships with working dev defaults)

# 2. Install dependencies
npm install

# 3. Start Postgres
docker compose up -d db

# 4. Apply Prisma migrations
npm run db:migrate

# 5. Seed demo data (account + exercise catalog + program + sample session)
npm run db:seed

# 6. Start the dev server
npm run dev
```

The app runs on http://localhost:3030. Postgres is exposed on `localhost:5433` on the host.

The demo account credentials come from `.env` (`USER_EMAIL` and `USER_PASSWORD`); the seed hashes the password at runtime.

## Configuration

All configuration is done through environment variables. See `.env.example` for the full list (database, JWT secret, demo account, and the AI provider keys).

## Testing

Three tiers: unit/component (Vitest + jsdom), integration (Vitest against a
real Postgres), and end to end (Playwright driving the built app).

```bash
npm run test            # unit and component tests
npm run test:coverage   # with coverage report

# Integration + E2E use a dedicated Postgres (docker-compose.test.yml, port 5434):
docker compose -f docker-compose.test.yml up -d
DATABASE_URL=postgresql://gymcoach_test:gymcoach_test@localhost:5434/gymcoach_test \
  npx prisma migrate deploy
npm run test:integration
npm run build && npm run test:e2e
docker compose -f docker-compose.test.yml down
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit, integration,
build and E2E on every push and pull request.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Next.js dev server (port 3030) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Unit and component tests |
| `npm run test:e2e` | End to end tests |
| `npm run format` | Prettier |
| `npm run db:migrate` | Apply migrations (dev) |
| `npm run db:reset` | Reset the database (drop + migrate + seed) |
| `npm run db:seed` | Load the demo dataset |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client |

## Project layout

```
.
├── app/              # Pages and API routes (App Router)
├── components/       # React components (Shadcn UI in components/ui)
├── lib/              # Helpers (db, auth, stats, llm, etc.)
├── prisma/           # Schema, migrations and seed
├── public/           # Static assets (PWA icons, manifest)
├── tests/            # Integration (Vitest) and E2E (Playwright) tests
├── docs/             # Project documentation
└── docker-compose*.yml
```

## Deployment

A production stack is provided through `docker-compose.prod.yml` (app + Postgres). Put it behind a reverse proxy (Nginx, Caddy, Traefik) for HTTPS.

```bash
cp .env.example .env
# Fill in real values (JWT_SECRET, the AI provider key, NEXTAUTH_URL, ...)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

## Roadmap

- [x] Single user MVP (logging, progress, weekly AI debrief, program adjustments)
- [x] Pluggable LLM provider (Anthropic SDK or OpenRouter, switchable via env)
- [x] Multi user support (registration, profiles, data isolation)
- [x] AI program generation from a natural language goal
- [x] Conversational AI coach (streaming chat with your training context)
- [x] Test pyramid (unit, integration, E2E) and CI
- [ ] In-session AI suggestions and natural-language set logging

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup,
conventions and the test commands.

## License

MIT, see [LICENSE](LICENSE).
