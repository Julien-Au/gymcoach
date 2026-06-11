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
- **Status:** graduated -> CI hardened: Postgres pulled from the rate-limit-free ECR Public
  mirror; the action runtimes bumped `checkout@v5`/`setup-node@v5` (which run on Node 24) and
  CI `node-version` 20 -> 22 to match the nvm toolchain (#67). Re-check-merged behavior: ship
  one PR at a time and let the gate run on the merged result (accepted process, noted in `09`).
  Reconfirmed during the first ideate batch: a "job was not acquired by Runner" failure (GitHub
  Actions infra, not a step in our workflow) was read as infra and re-run, not treated as a
  regression - exactly the L2 discipline.

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

### L6 - Prisma's generated `Set` model type shadows the global `Set`
- **Trigger:** the consistency-card lib (#71) needed a `Set<string>` of distinct trained days,
  but `import type { Set } from '@prisma/client'` (the workout-set model) is in scope across
  `lib/`, so a bare `Set<string>` / `new Set()` resolves to the Prisma model and the typecheck
  fails (`lib/stats.ts`).
- **Lesson:** in any `lib` module that touches both the Prisma `Set` model and JS collections,
  reference the runtime `Set` via `globalThis.Set` (type `globalThis.Set<...>`,
  value `new globalThis.Set(...)`) rather than the bare name. See `lib/stats.ts`
  `trainingConsistency`.
- **Status:** accepted risk - a narrow naming collision specific to this schema's `Set` model,
  not a recurring loop behavior; recorded so future `lib` work does not rediscover it under a
  red typecheck.

### L7 - Serialize tasks that touch the same file: wait for the prior PR to MERGE before spawning the next
- **Trigger:** the second ideate batch queued #81 and #82, which both edited `lib/stats.ts` and
  the progress dashboard. The two implement agents overlapped, so the second branch was cut from
  a `main` that did not yet contain the first's additions and hit a merge conflict (resolved by
  merging `main` into the branch and keeping both additions).
- **Lesson:** when two queued issues touch the same file(s), serialize strictly - do not spawn
  the next implement agent until the prior PR has actually **merged**, so the next branch cuts
  from a base that already contains the earlier change. Unrelated tasks may still overlap at the
  stage level; this rule is specifically for **same-file** tasks. This sharpens the existing
  "one writer per task" note (`implement-issue`/`ship-pr`) and `09`'s stage-vs-writer concurrency
  ("green separately, red together"): those cover the principle; this makes the trigger concrete -
  shared file means serialize on merge, not just on branch.
- **Status:** graduated -> orchestration practice (`06-orchestration.md` decision order + the
  "one linear writer per task" rule in `09-memory-and-learning.md` / `implement-issue` /
  `ship-pr`): same-file queued issues are dispatched one at a time, gated on the prior merge.

### L8 - A nested run without the spawning tool cannot satisfy the independent-review protocol by itself
- **Trigger:** the background maintainer tick implementing #90 (PR #95) had no subagent-spawning
  tool in its environment, so it executed the "multi-lens review" itself - the author grading
  its own homework, which the charter forbids. The orchestrator ran an independent post-merge
  review as a backstop; it confirmed ownership/migration/math were sound but found a real
  data-lifecycle defect the author had missed (deleting the achieving set left a goal
  permanently "Achieved"), fixed the same day in #97.
- **Lesson:** a self-executed review pass is not the subagent challenge. When a nested run
  cannot spawn an independent reviewer, it must flag that in its report, and the orchestrator
  must run an independent post-merge review as the very next action (or hold the PR pre-merge
  when feasible). The author reliably misses its own blind spots even when honestly running
  multiple "lenses" - independence, not effort, is what catches the defect.
- **Status:** graduated -> charter (`07-autonomy.md`, "Subagent challenge protocol"): the
  no-reviewer-available case is now an explicit rule with the post-merge backstop.

### L9 - Gates rot, permissions creep: schedule the meta-checks
- **Trigger:** an external loop-engineering writeup (2026-06-11) listed two failure modes
  our system had no answer for: a test that approved a fix can silently stop catching the
  regression it was written for ("gates rot" - we had never reverted a fix to confirm its
  test fails), and permission scope creep in an unattended loop's settings.
- **Lesson:** the loop's own controls need periodic verification, not just existence. A
  gate is only as good as the last time someone proved it can fail; a permission list is
  only as tight as its last re-read.
- **Status:** graduated -> `triage` skill (sources 6 and 7: monthly gate spot-check with
  revert-the-fix verification, ~30-day permissions re-audit), and the write-up skill now
  records the accepted-change rate per batch. External validation noted: the rest of the
  writeup's recommendations (maker/checker split, state files, objective gates, hard
  stops, regrounding spec) were already implemented here.
