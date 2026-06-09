---
name: write-up
description: Turn shipped work into the public story. After PRs merge, update the CHANGELOG and the docs/loops playbook so the "this repo maintains itself" narrative stays current and reproducible. Use when asked to "write up the démarche", "update the changelog", or as the unit the content loop calls.
---

# write-up

The tail of the pipeline and the actual growth engine. The product is the gym app; the
**story** - "this repo maintains itself with documented loops" - is what earns stars.
This skill keeps that story current and truthful after work ships. Read `CLAUDE.md`.

It writes **docs only** (CHANGELOG, `docs/loops/*`, README touch-ups). It never touches
product code. Output is one focused docs PR via `implement-issue` conventions, or a
commit on an existing docs branch.

## Inputs

- A set of recently merged PRs / closed issues (default: since the last CHANGELOG entry).
  Find them: `gh pr list --state merged --limit 20 --json number,title,mergedAt` and
  `git log --oneline origin/main` since the last documented change.

## What to keep current

1. **CHANGELOG.md** - move shipped, user-facing changes into the right `Unreleased`
   group (Added / Changed / Fixed). One terse line per change, no marketing. Skip
   internal-only churn unless it is itself the story (loop infra often is).
2. **docs/loops/** - when a *new loop or skill* shipped, add or update its numbered
   playbook entry so anyone can reproduce it. The playbook is the content; keep it
   honest (document what actually runs, including failure modes you hit).
3. **README** - only when a user-facing capability or the loop narrative changed enough
   to matter (features list, roadmap checkboxes). Keep edits minimal.
4. **docs/loops/lessons.md** - harvest any lesson the run surfaced (a failure mode, a
   surprise, a fix that should not have been needed). A lesson is only "learned" when it
   **graduates**: if it is general, edit the relevant skill or `CLAUDE.md`/charter so the
   behavior changes next time, then record the entry pointing at that change; otherwise mark
   it accepted risk. Do not just append prose - an un-acted lesson is noise. Prune/dedupe so
   the file stays high-signal. See `docs/loops/09-memory-and-learning.md`.

## Procedure

1. **Start clean** on `main` (`git switch main && git pull --ff-only`), branch
   `docs/<slug>`.
2. **Gather** the merged work since the last write-up. Map each item to a CHANGELOG
   group and decide if it warrants a playbook/README change. **Verify each claim against
   the code or the merged diff** - never document a feature that is not actually there
   (this skill exists partly because a changelog drifts otherwise).
3. **Write** the smallest accurate edits. English only, regular hyphens (no em/en-dash),
   Keep a Changelog format.
4. **Green-gate** (`bash scripts/verify.sh`) - docs-only, but the working agreement is
   the working agreement.
5. **Commit, push, PR** with `Closes #<n>` if a content issue exists, else a plain docs
   PR. The shipping loop (`ship-pr`) will merge it once CI is green.
6. **Report** what was documented and what was intentionally left out.

## Guardrails

- Truth over hype: every changelog/README claim is checked against merged code.
- Docs only - no product code, no merges (let `ship-pr` merge it).
- Do not document unmerged work as shipped (it belongs in the PR, not `main`'s story).

## What success looks like

The CHANGELOG and the `docs/loops/` playbook always reflect what actually shipped, so the
public démarche is current, reproducible, and trustworthy - the thing that compounds into
stars while the loops do the typing.
