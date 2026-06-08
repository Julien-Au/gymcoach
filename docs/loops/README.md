# Loops: how GymCoach maintains itself

This repo is partly maintained by **autonomous loops** running on Claude Code: small
programs that prompt the agent, read what it produced, verify it, and decide whether
to keep going. You stop prompting the agent and start authoring the loop.

This folder is the reproducible playbook. Read in order:

- [`00-concept.md`](00-concept.md) - what a loop actually is, the five-stage lineage,
  and the six ingredients mapped to real Claude Code tools.
- [`01-foundations.md`](01-foundations.md) - the four things a loop needs first:
  `CLAUDE.md`, the green-gate (`scripts/verify.sh`), permissions
  (`.claude/settings.json`), and a reusable skill.
- [`02-issue-to-pr-loop.md`](02-issue-to-pr-loop.md) - the flagship loop that turns
  open issues into pull requests, its guardrails, and how it graduates to the cloud.
- [`03-triage-loop.md`](03-triage-loop.md) - the head of the pipeline: manufacture
  well-scoped issues so the Issue -> PR loop never starves.
- [`04-ship-loop.md`](04-ship-loop.md) - the shipping half: watch CI, fix a red gate,
  self-review, and auto-merge on green. Where the full gate actually gates a merge.
- [`05-content-loop.md`](05-content-loop.md) - the tail: keep the CHANGELOG and this
  playbook true to what shipped. The growth engine.
- [`06-orchestration.md`](06-orchestration.md) - the maintainer loop that runs all the
  stages end to end, and how it graduates to a nightly cron.

## The system at a glance

```
            maintainer loop (06): cron + a decision-maker each tick
                                  |
   +----------------+------------+------------+-----------------+
   v                v                         v                 v
 triage (03)   implement-issue (02)      ship-pr (04)      write-up (05)
 refill the    one issue -> one PR       watch CI, fix     CHANGELOG +
 backlog       (branch->code->test)      red, self-review, playbook stay
 when low                                auto-merge GREEN  true to reality
   |                |                         |                 |
   +----------------+------------+------------+-----------------+
                                  |
                    scripts/verify.sh + CI = the feedback gate
                    (nothing merges on a red or pending gate)
                                  |
                    state lives in git + GitHub, not the session
```

The pipeline is **generate work -> do work -> verify in CI -> ship -> tell the story**.
Each stage is a small loop calling one tested skill; `06` is the loop that runs them.

## The four rules we never break

1. A loop is only as good as its feedback - everything self-verifies before claiming
   success.
2. The reusable unit is a skill, not a prompt.
3. The loop must halt - max iterations, no-progress detection, budget ceiling.
4. Durability is explicit - state lives in git and on GitHub, not only in a session.
