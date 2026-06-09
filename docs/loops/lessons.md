# Lessons (the staging area for self-learning)

This is **procedural memory in waiting**. A lesson here is not "learned" until it has
**graduated** - edited a skill or `CLAUDE.md`/the charter so the behavior changes
automatically next time - or been explicitly marked **accepted risk**. See
`docs/loops/09-memory-and-learning.md` for why (a deep log no one re-reads changes nothing).

`write-up` (`05`) harvests new lessons here each run and graduates the general ones. Keep
entries **specific and actionable**, prune duplicates, and never let this file become an
un-pruned dump.

Format per entry: trigger/evidence, the lesson (actionable), and **Status** = `graduated
(-> where)` or `accepted risk (why)`.

## Lessons

### L1 - Trust-gate on the login allowlist, never `authorAssociation == OWNER`
- **Trigger:** building the public-repo guardrail (#54/#56). The skeptic suggested gating on
  `OWNER`; the loop's own account `JulienAu` is a `COLLABORATOR`, not `OWNER`, and
  `authorAssociation` is not even a `gh ... --json` field.
- **Lesson:** gate auto-implement/auto-merge on `author.login in {JulienAu, Julien-Au}`
  (GitHub authorship is authenticated, so this is the real control). Requiring `OWNER` would
  lock the loop out of its own work and destroy autonomy.
- **Status:** graduated -> `07-autonomy.md` "Untrusted external input" + `implement-issue`,
  `ship-pr`, `triage` skills (#56).

### L2 - A post-merge red on `main` is usually transient infra, not a regression
- **Trigger:** two `main` CI runs red-failed at the integration job's "Initialize
  containers" step (`Docker pull failed`); the tests never ran. PRs had been green.
- **Lesson:** before assuming a regression, read which *step* failed - a Docker/registry
  pull failure is infra; re-run the job. Also: PRs cut from the same `main` and merged close
  together can be green alone but need a re-check merged ("green separately, red together").
- **Status:** graduated -> CI hardened to pull Postgres from the rate-limit-free ECR Public
  mirror, actions bumped for Node 24 (#67). Re-check-merged behavior: ship one PR at a time
  and let the gate run on the merged result (accepted process, noted in `09`).

### L3 - The orchestrator owns CI-watch and merge; subagents stop at the PR
- **Trigger:** background maintainer-tick agents repeatedly terminated early - they ended
  while "watching CI" before merging, leaving green PRs unmerged.
- **Lesson:** an implementation subagent should implement -> verify -> push -> open the PR
  and **STOP**. The driving thread (orchestrator) owns the deterministic CI-watch + squash
  -merge. This both fixes the early-termination and matches "one linear writer" (Cognition).
- **Status:** graduated -> `implement-issue` and `ship-pr` operational notes.

### L4 - A fresh checkout/worktree needs `npm ci` (+ native rebuild) and a migrated test DB
- **Trigger:** the green-gate failed in a fresh git worktree - `npx prisma` pulled the
  latest Prisma (wrong major), and `bcrypt`'s native binding was missing.
- **Lesson:** in any fresh checkout/worktree, run `npm ci` first (worktrees do not share
  `node_modules`), `npm rebuild bcrypt` if the native binding is missing, and
  `prisma migrate deploy` against the test Postgres on :5434 before integration/E2E.
- **Status:** graduated -> `implement-issue` and `ship-pr` operational notes.

### L5 - This environment's `gh` is an older build; some flags do not exist
- **Trigger:** `gh label`, `gh issue close --reason/--comment`, `gh run rerun --failed/--job`,
  and `--json authorAssociation` all failed as unknown.
- **Lesson:** prefer `gh api` (e.g. labels, `author_association`) and two-step flows
  (`gh issue comment` then `gh issue close`); do not assume the newest `gh` surface.
- **Status:** accepted risk - operational quirk of this environment, not worth encoding in a
  product skill; recorded here so future runs do not rediscover it.
