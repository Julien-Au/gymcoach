# GymCoach

Open source, self hosted hypertrophy training tracker with a built in AI coach. Log your sessions, track your progress, and get evidence based weekly debriefs and program suggestions from the LLM of your choice (Anthropic Claude or any OpenRouter model).

> Status: open source edition, under active rework. The codebase is being migrated from a single user personal app to a multi user, provider agnostic project with a full test suite and deeper AI integration. See the Roadmap below.

## Features

- Workout logging with sets, reps, RIR, warmups and drop sets
- Progress charts and estimated 1RM tracking
- Bodyweight aware tonnage (pull ups, dips, etc.)
- AI coach: weekly debrief and assisted program adjustments
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

```bash
npm run test          # unit and component tests (Vitest)
npm run test:coverage # with coverage report
npm run test:e2e      # end to end tests (Playwright)
```

A dedicated Postgres instance for integration and E2E tests is provided in `docker-compose.test.yml`.

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
├── tests/            # End to end tests (Playwright)
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
- [ ] Pluggable LLM provider (Anthropic SDK or OpenRouter, switchable via env)
- [ ] Multi user support (registration, profiles, data isolation)
- [ ] AI program generation from a natural language goal
- [ ] Conversational AI coach (streaming chat with your training context)
- [ ] Full test pyramid (unit, API integration, E2E) and CI

## Contributing

Contributions are welcome. A `CONTRIBUTING.md` with guidelines will land as the project stabilizes.

## License

MIT, see [LICENSE](LICENSE).
