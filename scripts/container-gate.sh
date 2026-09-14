#!/usr/bin/env bash
# Run the default green-gate tier (prisma generate + lint + typecheck + unit + build)
# on a git ref inside an ephemeral, isolated container.
#
# Why: external contributor code is never executed on the operator host
# (docs/loops/10-external-contributions.md, "The execution gate"). CI is the only
# executor of unvetted code; when a vetted-tier PR genuinely needs a local run
# (a maintainer fixup, a conflict resolution), it runs here instead - a fresh
# archive of the committed ref, no network, no credentials, no .env.
#
# Usage: scripts/container-gate.sh <repo-dir> <git-ref> [tag]
#   <repo-dir>  a checkout or worktree that holds <git-ref>
#   <git-ref>   the ref to gate (a branch, a SHA, HEAD)
#   [tag]       names the throwaway archive in TMPDIR (default: gate), so two
#               gate runs can be in flight at once
#
# NOTE: it archives the COMMITTED tree at <git-ref>. Uncommitted edits are NOT
# gated - commit first, or you are gating something other than what you changed.
set -euo pipefail

REPO="$1"; REF="$2"; TAG="${3:-gate}"
S="$(cd "$(dirname "$0")" && pwd)"
# node_modules comes from this script's own repo root, not a hardcoded path, so
# the gate works from any clone. It is mounted read-only and holds no credentials.
MAIN_REPO="$(git -C "$S" rev-parse --show-toplevel)"
ARCHIVE="${TMPDIR:-/tmp}/gymcoach-container-gate-$TAG.tar"

# The contributor tree is unpacked into a throwaway directory outside the repo,
# never into the checkout. --user below means everything the container writes is
# owned by the caller, so this cleans up without a root-owned leftover.
WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK" "$ARCHIVE"; }
trap cleanup EXIT

git -C "$REPO" archive --format=tar -o "$ARCHIVE" "$REF"
tar -xf "$ARCHIVE" -C "$WORK"

# --network none: nothing in the archive can reach the network. Consequence:
# npm must be told to stay offline, or `npx prisma generate` probes the registry
# and dies with EAI_AGAIN.
# VITEST_MAX_*=6: the default worker count over-subscribes the container and a
# 5 s component test times out at ~5.2 s.
# --user: without it the container writes .next / prisma/generated as root, and
# the leftovers cannot be deleted (or a worktree removed) without another container.
docker run --rm --network none \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp/home -e CI=1 -e NEXT_TELEMETRY_DISABLED=1 \
  -e npm_config_offline=true -e VITEST_MAX_THREADS=6 -e VITEST_MAX_WORKERS=6 \
  -v "$WORK:/w" \
  -v "$MAIN_REPO/node_modules:/w/node_modules:ro" \
  --workdir /w node:22-bookworm \
  bash -lc 'mkdir -p /tmp/home && bash scripts/verify.sh'
