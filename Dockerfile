# ============================================================
# GymCoach - Dockerfile production multi-stage
# ============================================================
# Stages : deps -> builder -> prod-deps -> runner
# Utilise `output: 'standalone'` de next.config.js, complete par un node_modules
# de production complet (le client Prisma 7 + sa CLI de migration tirent une
# fermeture de dependances que le tracing standalone ne capture pas).

# ---- Stage 1: deps (full install for the build) ----
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ---- Stage 2: builder ----
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Demo-mode flags are NEXT_PUBLIC_* and therefore baked in at build time.
# Default off: a normal self-host build is unchanged. The public demo passes
# these as build args (see docker-compose.prod.yml).
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG NEXT_PUBLIC_DEMO_EMAIL=
ARG NEXT_PUBLIC_DEMO_PASSWORD=
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE \
    NEXT_PUBLIC_DEMO_EMAIL=$NEXT_PUBLIC_DEMO_EMAIL \
    NEXT_PUBLIC_DEMO_PASSWORD=$NEXT_PUBLIC_DEMO_PASSWORD

# Generation du client Prisma puis build Next.js
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: prod-deps (production-only node_modules for the runner) ----
# Prisma 7 dropped the bundled Rust engine: the app talks to Postgres through the
# pg driver adapter at runtime, and `prisma migrate deploy` loads prisma.config.ts
# through @prisma/config, which pulls a deep dependency closure (effect, c12, ...).
# Cherry-picking those out of node_modules is unmaintainable (it is what made the
# bcrypt #127 image bug recur), so the runner gets a real `npm ci --omit=dev`
# tree: app runtime deps + the Prisma CLI + tsx (the demo reseed). bcrypt's
# native binding is built here for the alpine target too.
FROM node:22-alpine AS prod-deps
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---- Stage 4: runner ----
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# User non-root pour la securite
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Production node_modules first, then the standalone server overlays its own
# bundled output on top. The standalone tree is a subset of prod-deps, so this
# order keeps the full, correctly-resolved dependency closure.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Next.js standalone output.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma needs the schema, the generated client (under prisma/generated, copied
# via /app/prisma), and the config file that carries the datasource URL for
# `prisma migrate deploy` at container start. The runtime @prisma/client, the pg
# adapter and the CLI all live in the prod-deps node_modules above.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
