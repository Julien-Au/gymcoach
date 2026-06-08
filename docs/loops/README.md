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

## The system at a glance

```
/loop (cron + decision-maker)
   |
   v
implement-issue  (the reusable skill: branch -> code -> test -> PR)
   |
   v
scripts/verify.sh  (the green-gate: lint + typecheck + unit + build)   <- feedback
   |
   v
green PR that closes an issue   ->   a human reviews and merges
```

## The four rules we never break

1. A loop is only as good as its feedback - everything self-verifies before claiming
   success.
2. The reusable unit is a skill, not a prompt.
3. The loop must halt - max iterations, no-progress detection, budget ceiling.
4. Durability is explicit - state lives in git and on GitHub, not only in a session.
