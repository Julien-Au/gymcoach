#!/usr/bin/env bash
#
# verify.sh — the GymCoach green-gate.
#
# This is the self-verification step every autonomous loop must pass before it
# claims a task is done (see docs/loops/). It mirrors the CI "quality" + "build"
# jobs so a loop can catch its own regressions locally, in seconds, without a
# database.
#
#   PASS  -> exit 0, the working tree is safe to commit / open a PR from.
#   FAIL  -> exit non-zero, the loop must fix the reported step before retrying.
#
# Tiers:
#   (default)  prisma generate + lint + typecheck + unit tests + production build
#   --full     also runs integration + E2E (needs the test Postgres on :5434)
#
# The integration/E2E tiers need Docker + a database, so the default gate stays
# fast and hermetic; CI runs the full pyramid on every PR.

set -uo pipefail

# --- Make node 22 (nvm) available even in a non-interactive shell -------------
# The repo requires Node >= 20. The system node may be older, so prepend the
# nvm install if present. Adjust NVM_NODE if your version differs.
NVM_NODE="${NVM_NODE:-$HOME/.nvm/versions/node/v22.17.1/bin}"
if [ -d "$NVM_NODE" ]; then
  export PATH="$NVM_NODE:$PATH"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

FULL=0
[ "${1:-}" = "--full" ] && FULL=1

fail() { echo ""; echo "❌ GREEN-GATE FAILED at: $1"; exit 1; }
step() { echo ""; echo "▶ $1"; }

echo "GymCoach green-gate — node $(node -v 2>/dev/null || echo '??'), npm $(npm -v 2>/dev/null || echo '??')"

step "prisma generate"
npx prisma generate >/dev/null || fail "prisma generate"

step "lint"
npm run lint || fail "lint"

step "typecheck"
npm run typecheck || fail "typecheck"

step "unit tests"
npm run test || fail "unit tests"

step "production build"
# Build needs these set but never connects; placeholders are fine and are NOT
# exported globally (so real prisma/dev commands keep using your .env).
DATABASE_URL="postgresql://user:pass@localhost:5432/db" \
JWT_SECRET="ci-build-placeholder-secret-at-least-32-chars" \
  npm run build || fail "production build"

if [ "$FULL" = "1" ]; then
  step "integration tests (needs Postgres on :5434)"
  npm run test:integration || fail "integration tests"
  step "E2E tests (Playwright)"
  npm run test:e2e || fail "E2E tests"
fi

echo ""
echo "✅ GREEN-GATE PASSED — safe to commit and open a PR."
