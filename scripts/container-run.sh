#!/usr/bin/env bash
# Run one command against a worktree inside an isolated container - the one-off
# companion to scripts/container-gate.sh (prettier, a single vitest file, a
# targeted build) while resolving or fixing up an external contributor's branch.
#
# Same isolation: no network, no credentials, no .env. The worktree is bind-mounted
# read-write so formatters can write back, and host node_modules is mounted
# read-only. --user keeps everything the container writes owned by the caller, so
# `git worktree remove` still works afterwards.
#
# Usage: scripts/container-run.sh <worktree-dir> <command...>
#   REPO=<dir> overrides where node_modules is taken from (default: this script's repo).
set -euo pipefail

WT="$1"; shift
S="$(cd "$(dirname "$0")" && pwd)"
MAIN_REPO="${REPO:-$(git -C "$S" rev-parse --show-toplevel)}"

docker run --rm --network none \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp/home -e CI=1 -e NEXT_TELEMETRY_DISABLED=1 \
  -e npm_config_offline=true -e VITEST_MAX_THREADS=6 -e VITEST_MAX_WORKERS=6 \
  -v "$WT:/w" -v "$MAIN_REPO/node_modules:/w/node_modules:ro" \
  --workdir /w node:22-bookworm bash -lc "mkdir -p /tmp/home && $*"
