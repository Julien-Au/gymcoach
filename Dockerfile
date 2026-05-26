# ============================================================
# GymCoach - Dockerfile production multi-stage
# ============================================================
# Stages : deps -> builder -> runner
# Utilise `output: 'standalone'` de next.config.js pour minimiser
# la taille de l'image finale.

# ---- Stage 1: deps ----
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

# Génération du client Prisma puis build Next.js
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: runner ----
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# User non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copie de l'output standalone Next.js
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma : on a besoin du schema, des binaires runtime, ET de la CLI (utilisée
# par `prisma migrate deploy` au démarrage du conteneur). On évite le shim
# .bin/prisma car le COPY ne préserve pas le symlink et perd les .wasm voisins ;
# on appelle directement node_modules/prisma/build/index.js.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
