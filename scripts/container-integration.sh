#!/usr/bin/env bash
# Run the integration tier (Vitest against a real Postgres) on a worktree inside an
# isolated container - the database-backed companion to scripts/container-gate.sh
# and scripts/container-run.sh.
#
# Why: external contributor code is never executed on the operator host
# (docs/loops/10-external-contributions.md, "The execution gate"). The default
# container gate has no database, so before this script the integration tier of a
# fixup on a vetted fork PR could only run in CI. Here the test container's only
# network reach is a throwaway Postgres on an --internal docker network: no route
# to the host or the internet, no credentials, no .env.
#
# Usage: scripts/container-integration.sh <worktree-dir> <db-suffix> [vitest file filters...]
#   <worktree-dir>  the worktree to test (bind-mounted read-write, like container-run.sh)
#   <db-suffix>     names this run's database (letters, digits, underscore), so two
#                   worktrees tested side by side never share tables (e.g. 362, 368)
#   [filters...]    optional vitest file filters, e.g. tests/integration/gyms
#
#        scripts/container-integration.sh down
#   removes the database container and the network afterwards.
#
# REPO=<dir> overrides where node_modules is taken from (default: this script's repo).
set -euo pipefail

NET=gymcoach-integration-net
DB=gymcoach-integration-db

if [ "${1:-}" = "down" ]; then
  docker rm -f "$DB" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  echo "removed $DB and $NET"
  exit 0
fi

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <worktree-dir> <db-suffix> [vitest file filters...] | $0 down" >&2
  exit 2
fi

WT="$(cd "$1" && pwd)"; SUFFIX="$2"; shift 2
# The suffix ends up in SQL (DROP/CREATE DATABASE), so it is restricted to a safe charset.
if ! [[ "$SUFFIX" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "db-suffix must match [A-Za-z0-9_]+" >&2
  exit 2
fi
S="$(cd "$(dirname "$0")" && pwd)"
MAIN_REPO="${REPO:-$(git -C "$S" rev-parse --show-toplevel)}"
DBNAME="int_$SUFFIX"

# --internal: containers on this network reach each other and nothing else.
docker network inspect "$NET" >/dev/null 2>&1 || docker network create --internal "$NET" >/dev/null
# The database lives in tmpfs, so it holds nothing once the container stops. It is
# reused across runs (one database per suffix inside it) until `down`.
if ! docker ps --format '{{.Names}}' | grep -qx "$DB"; then
  docker run -d --rm --name "$DB" --network "$NET" --tmpfs /var/lib/postgresql/data \
    -e POSTGRES_USER=gymcoach_test -e POSTGRES_PASSWORD=gymcoach_test -e POSTGRES_DB=gymcoach_test \
    postgres:16-alpine >/dev/null
fi
for _ in $(seq 1 30); do
  docker exec "$DB" pg_isready -U gymcoach_test -d gymcoach_test >/dev/null 2>&1 && break
  sleep 1
done
# Fresh database per run, so an edited migration never meets a stale schema.
docker exec "$DB" psql -U gymcoach_test -d gymcoach_test -q \
  -c "DROP DATABASE IF EXISTS $DBNAME WITH (FORCE);" -c "CREATE DATABASE $DBNAME;" >/dev/null

# npm_config_offline: the test container has no internet, and `npx prisma generate`
# otherwise probes the registry and fails.
# VITEST_MAX_*=1, not the unit tier's 6: forcing a worker cap overrides the
# integration config's `fileParallelism: false`, test files then run in parallel
# against the same database and truncate each other's tables (foreign key failures).
# One worker keeps the files serial, as the integration config intends.
# --user: everything written into the worktree (prisma/generated) stays owned by
# the caller, so `git worktree remove` still works afterwards.
docker run --rm --network "$NET" \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp/home -e CI=1 -e NEXT_TELEMETRY_DISABLED=1 \
  -e npm_config_offline=true -e VITEST_MAX_THREADS=1 -e VITEST_MAX_WORKERS=1 \
  -e DATABASE_URL="postgresql://gymcoach_test:gymcoach_test@$DB:5432/$DBNAME" \
  -v "$WT:/w" -v "$MAIN_REPO/node_modules:/w/node_modules:ro" \
  --workdir /w node:22-bookworm \
  bash -lc "mkdir -p /tmp/home && npx prisma generate >/dev/null && npx prisma migrate deploy && npx vitest run --config vitest.integration.config.ts $*"
