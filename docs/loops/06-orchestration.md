# 06 — Orchestration (the self-maintaining repo)

The first five files built the **stages**: triage finds work, implement does it, ship
merges it, write-up tells the story. Each is a small loop calling a tested skill. This
file ties them into one **maintainer loop** that runs the whole pipeline end to end - the
thing that lets the repo maintain itself while you sleep.

```
        +-----------------------------------------------------------+
        |                    maintainer loop                        |
        |                                                           |
        v                                                           |
  triage (03) --> implement-issue (02) --> ship-pr (04) --> write-up (05)
   refill if          one issue              merge every        tell the
   backlog low        -> one PR              green PR           story
        ^                                                           |
        +-----------------------------------------------------------+
                 git + GitHub hold the state between ticks
```

## The decision-maker in the body

A cron job runs a fixed script; a loop runs a model that **looks at current state and
decides what to do next**. The maintainer loop's decision each tick:

1. **Are there ready PRs?** (green or fixable CI) -> ship them first. Shipping finishes
   started work and moves `main` forward; always drain this before starting new work.
2. **Is the backlog low** (no actionable, unclaimed issue)? -> run triage to refill it with
   code-health work.
3. **Still no actionable issue after triage?** -> run `ideate` (08) to manufacture bounded
   **product** ideas, so the loop keeps improving the product, not just tidying it. (Hard
   caps: <= 3 issues, no run while >= 3 idea issues are open, never the heavy
   deep-research workflow.)
4. **Is there an actionable issue?** -> implement the next one (-> a PR, which next tick's
   step 1 will ship). If two queued issues touch the **same file(s)**, serialize: implement
   one, wait for its PR to actually **merge**, then implement the next from the updated `main`.
   Do not overlap same-file tasks, or the second branch cuts from a stale base and hits a merge
   conflict (lesson L7). Unrelated tasks may still overlap at the stage level (see `09`).
5. **Did things merge since the last write-up?** -> run the content loop.
6. **Nothing to do on any of the above?** -> stop. A clean idle is success, not failure.

Order matters: finish before you start (ship before implement), and only manufacture work
(triage, then ideate) when genuinely starved, so the tracker and the PR queue never flood.
Ideation sits below triage on purpose: ideas are made only when the loop would otherwise
idle, and implementation drains them before more are made.

## Running it

Phase 1 - watched, locally:

```
/loop You are the maintainer of this repo. Each tick: (1) ship any ready PR with ship-pr;
(2) if the backlog is low, run triage; (3) if there is still no actionable issue, run
ideate to manufacture bounded product ideas; (4) implement the next actionable issue with
implement-issue; (5) if work merged since the last write-up, run write-up. Respect every
skill's own guardrails (including ideate's hard caps: <= 3 issues, no run while >= 3 idea
issues are open, never the heavy deep-research workflow). STOP when there is nothing to
ship, no actionable issue, ideate has nothing new to add, and nothing to document - or
after 3 merges this run. Auto-merge only on green CI; never on main directly.
```

Phase 2 - unattended, on infrastructure:

- Flip `.claude/settings.json` to `bypassPermissions` for the cron run (it cannot pause to
  ask). Keep the **deny-list** - it still blocks the destructive ops.
- `/schedule` the same prompt nightly. State lives in git (one branch per task) and on
  GitHub (issues + PRs), so a crash mid-run loses nothing; the next tick re-reads reality
  and continues.

## The four rules, at the orchestration level

1. **Feedback** - every stage self-verifies (green-gate locally, **CI before merge**).
   Nothing lands on optimism.
2. **Skills, not prompts** - the maintainer loop is thin glue; all discipline lives in the
   four tested skills. Tighten a skill when you see a failure mode; every loop benefits.
3. **It must halt** - each stage caps its output (3 issues, 1 issue->PR, 3 fix attempts, 1
   docs PR) and the maintainer caps merges per run and stops on a clean idle. Three layers
   of stop.
4. **Durability** - the only state that matters is in git and on GitHub. The session is
   disposable; the pipeline is resumable.

## What "autonomous end to end" actually means here

A human still owns *what the project is for* - the vision, the hard product calls, the
occasional "this PR needs a human". Everything mechanical between "there is work" and "it
is shipped and documented" runs without a click. The job moved up an altitude: from
writing the code to **authoring the loops that write it** - and this file is the loop that
runs the loops.
