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

### L10 - Close the gate's cheat path and stop retrying what just failed identically
- **Trigger:** an external "self-improving loop" writeup (2026-06-11) review against our
  system. Two rules we relied on implicitly but had never written: nothing forbade a tick
  from getting a red gate green by weakening a test (deleting/skipping it, loosening an
  assertion, swallowing the error), and nothing said what to do when the same error
  repeats - the 3-attempt cap allowed three identical guesses in one tired context.
- **Lesson:** (a) "fix the code, never the test" must be an explicit rule wherever the
  gate is described - a weakened test is a defect, and reviewers should treat it as one;
  (b) two identical failures in a row mean the fixer is guessing - the next attempt
  belongs to a fresh-context fixer subagent (re-diagnose from scratch), not retry #3.
  Same independence principle as L8, applied to fixing instead of reviewing.
- **Considered and declined from the same writeup:** PostToolUse/Stop hooks running
  tsc/tests on every edit or stop. Our loop verifies at task boundaries (verify.sh is
  mandatory before any PR); per-edit hooks would add ~15s latency to every edit in every
  session for marginal gain in a batch-oriented loop. Accepted decision, not a gap.
- **Status:** graduated -> CLAUDE.md (green-gate section), `ship-pr` step 3,
  `implement-issue` step 5.

### L11 - A tick that died mid-run can come back as a zombie writer: stop it before relaunching
- **Trigger:** a maintainer tick died on a transient API 529, the orchestrator relaunched a
  fresh tick into the same checkout, and the dead tick later re-woke and wrote concurrently
  in the working tree while the new tick was implementing #145 (the new tick caught it,
  verified every line against the spec, and the independent review confirmed nothing
  foreign landed - but only luck made the two writers converge on the same spec).
- **Lesson:** "one writer per checkout" applies to dead agents too. Before relaunching a
  replacement tick into the same working tree, explicitly stop the dead task (TaskStop) or
  confirm it can no longer wake; on relaunch, the new tick should `git status` first and
  treat unexpected tree changes as a stop-and-reground signal, not something to absorb.
- **Status:** graduated -> `06-orchestration.md` (relaunch-after-crash rule) and the
  orchestrator's memory; review prompts after any two-writer episode must include an
  injected-code scan (done for #149, verdict clean).

### L12 - Recorded demo media was never verified for content: a clip of an error page passed every gate
- **Trigger:** the operator reported "Application error" showing in the README demo videos.
  The committed GIFs are produced by scripts/record.mjs, which used a `tryClick` that
  swallowed every failure and never asserted the app was healthy - so a recording made
  against a crashed/stale server (which happened twice this session when a zombie next-server
  held the port) produces a webm of the Next.js error overlay, and nothing downstream
  (verify.sh, CI, docker-smoke, the human skim) ever looks at the *content* of a clip. Green
  everywhere, broken on the page.
- **Lesson:** generated media is an output that needs its own gate. The cheapest correct
  place is at capture: the recorder must fail loudly (non-zero exit, footage discarded) if
  the page ever shows an error overlay / a 404 / a 5xx / an uncaught pageerror. Because the
  only way a committed GIF is produced is through the recorder, a self-verifying recorder
  closes the loop without OCR on the committed file.
- **Update (2026-06-12):** the SAME gap existed in scripts/screenshots.mjs - two of the four committed README screenshots (progress.png, catalog.png) were the "Application error" page, captured during the same stale-server episode. Both scripts now self-verify identically.
- **Status:** graduated -> scripts/record.mjs AND scripts/screenshots.mjs now watch pageerror + >=500 responses and
  asserts on-screen error text after every click and at each scenario's key step, exiting 1
  and discarding the webm on any hit (proven with a negative probe: pointing it at a 404
  route aborts). The write-up skill's media step references this. Also a reminder of L11:
  the stale-server episodes that caused the bad captures were zombie next-server processes -
  kill servers/ports before recording.

### L13 - A major framework upgrade is tractable as ONE careful PR when you lean on the codemod, swap the unmaintained plugin, and use the image smoke test as the net
- **Trigger:** issue #169 (Next 14 -> 15, the stop-for-human major bump) was operator-authorized. Done as one branch: bump next/react/types + eslint-config-next; replace the unmaintained next-pwa with the maintained @ducanh2912/next-pwa (the real blocker - the old plugin has no Next 15 support); run the official `next-async-request-api` codemod for the cookies/params/searchParams async change (23 app files + lib/auth), then fix the integration tests that call handlers with sync `{params}` to pass `Promise.resolve({...})`.
- **Lesson:** the migration surface for a major Next bump is mostly mechanical IF (a) you scope the dependency-compat blockers first (here: only the PWA plugin was incompatible; Radix/recharts/next-themes/testing-library were all React-19 ready), (b) you use the official codemod rather than hand-editing the async-API surface, and (c) you treat the production Docker image as the load-bearing gate - the docker-smoke CI job (built for the bcrypt episode, lesson around #127) is exactly what proves the standalone runtime survived; verify it locally before merge AND let CI re-run it. The npm-audit goal: the 14 RUNTIME Next CVEs cleared; the residual advisories are build-time only (workbox toolchain behind the PWA plugin), an accepted-risk end state, not a failure.
- **Status:** accepted approach for future major framework bumps; rollback baseline tagged before the work (autonomy-baseline-2026-06-13-next15). The remaining workbox build-time advisories would need a Serwist migration (bigger, separate).

### L14 - Branch BEFORE editing: after `git switch main`, the first edit must be on a task branch
- **Trigger:** twice now (#259 GPX-track on 2026-06-23, and the TCX-track work on 2026-06-30) I committed and pushed a feature DIRECTLY to `main`. Both times the cause was identical: a prior step ended with `git switch main` (to sync / merge a previous PR), then the next task's edits started without a `git switch -c` - so the work landed on `main`, bypassing the PR + pre-merge review gate (a CLAUDE.md rule).
- **Lesson:** the dangerous moment is the START of a new unit of work that follows a `main` checkout. Make branching the FIRST action of any task that will edit files - `git switch -c <type>/<slug>` before the first Edit/Write, not after. Recovery when it happens anyway: CI runs on push to `main` (so the change is still gated), but run the independent review POST-HOC and fix any finding forward via a real PR; never force-push to "undo" shared `main`. Both slips ended green + reviewed SHIP, but a gate-skip is exactly what the charter forbids - the fix is the habit, not the recovery.
- **Status:** standing rule. If a turn begins on `main` and will write code, branch first.

### L15 - Concurrent ticks must not share one working tree: isolate with git worktrees, or serialize
- **Trigger:** 2026-07-15 batch. Two ticks ran against the SAME checkout at once: the #278
  ship tick did `git switch main` (to sync the merged PR) while the #270 dev tick still had
  uncommitted work in that same tree. The switch + a stray commit put an intermediate commit
  (`a49e21f`) directly on `main` - a breach of hard guardrail 1 (never commit to `main`).
  This is a DIFFERENT cause than L14: L14 is one writer forgetting to branch; L15 is two
  writers sharing one tree, where even a correctly-branched tick is unsafe because another
  tick can move `HEAD`/`main` and capture its uncommitted work. Remediated without
  force-push: revert `fe25d66` restored `main` to `b2221f5` exactly (CI green), work
  cherry-picked onto a feature branch and shipped as PR #279.
- **Lesson:** a git checkout is single-writer state. Two ticks in one working tree race on
  `HEAD`, the index, and the branch pointer - one tick's `git switch`/commit can strand or
  mis-attribute the other's work onto `main`. The orchestrator must give each concurrently
  running dev/ship tick its OWN git worktree (`git worktree add`), so branch checkouts and
  commits never collide; until worktree isolation is in place, same-checkout ticks must be
  strictly SERIALIZED (never overlap two ticks in one tree). Extends L7/L11 ("one writer per
  checkout") from same-file and zombie-writer cases to the general concurrent-tick case, and
  makes the control structural (separate trees) rather than behavioral (remember to branch).
- **Status:** graduated -> `06-orchestration.md` ("Concurrent ticks: one worktree each"):
  concurrent dev/ship ticks get isolated `git worktree`s; without isolation, serialize
  same-checkout ticks. Recovery when a commit still lands on `main`: revert forward (never
  force-push shared history), then re-ship via a proper PR.

### L16 - Isolated worktrees are not enough: the shared test Postgres (:5434) and dev port (:3031) also need a lock
- **Trigger:** 2026-07-22 batch. Two loop sessions ran `bash scripts/verify.sh --full` at the
  same time from SEPARATE git worktrees (so L15 was satisfied - no shared checkout). They still
  collided on shared INFRA: both point at the one test Postgres on host port 5434 and both bind
  the dev/E2E server on 3031. One run's `TRUNCATE ... CASCADE` reset the DB while the other was
  mid-suite, and the port was contended, yielding a spurious E2E failure that was green on an
  isolated re-run.
- **Lesson:** worktree isolation fixes the git-state race (L15) but not the runtime-infra race.
  The integration/E2E tiers assume single-tenant ownership of :5434 and :3031; two concurrent
  `--full` runs violate that assumption and corrupt each other non-deterministically. The fix is
  structural (a lock around those tiers, or a per-run unique DB name + free port), not "remember
  not to overlap."
- **Status:** graduated -> filed **#283** to serialize-or-isolate the shared test infra. INTERIM
  rule until #283 lands: the orchestrator must not run two `verify.sh --full` invocations against
  :5434/:3031 concurrently - serialize them (a green isolated re-run of the failed tier is the
  tell that a red was this contention, not a regression; acknowledge the actual failing step
  before re-planning, per L2).
