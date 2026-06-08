# 00 — What a loop is (and what we are building)

> This directory documents how the GymCoach repository is maintained, in large
> part, by **autonomous loops** running on Claude Code. It is written to be
> reproducible: clone the patterns here into any repo and you get the same
> system. This file is the conceptual baseline; the numbered files that follow
> are the build log.

## The one-sentence definition

A **loop** is a small program you write that prompts a coding agent for you,
reads what it produced, decides whether it is done, and if not, prompts it
again. You stop being the thing inside the loop typing prompts. You become the
**author** of the loop. The model becomes a subroutine.

Put differently: **a loop is a cron job plus a decision-maker in the body.** A
cron job runs a fixed script. A loop runs a model that looks at the current
state, decides what to do next, does it, checks whether it worked, and decides
whether to keep going. The decision is the agent's, not a hardcoded branch.

## The five-stage lineage (so we know where we sit)

1. **ReAct (2022)** — reason, call a tool, read result, repeat. One model, one
   loop, a human watching.
2. **AutoGPT (2023)** — gave it a goal and let it prompt itself. Famous for
   spinning forever doing nothing.
3. **ralph (2025)** — a bash one-liner piping the same prompt file into the
   agent repeatedly. Innovation: **discipline** — every iteration resets context
   to fixed anchor files instead of letting the conversation grow.
4. **/goal, /loop (spring 2026)** — productized ralph: run until a validator
   confirms the task is done.
5. **Orchestration loops (now)** — loops supervising other loops, concurrently,
   on a schedule, with durable git-backed state and crash recovery. **This is
   what we are building.**

Single-agent ralph is old hat. The multi-agent, self-verifying, scheduled,
durable layer on top is the new thing.

## The six ingredients, mapped to the tools we actually have

| Ingredient | What it means | Our concrete tool |
| --- | --- | --- |
| **Skill** | the reusable, named, tested unit the loop calls | `.claude/skills/*` |
| **The loop** | cron + a decision-maker | `/loop` (local) → `/schedule` (cloud cron) |
| **Self-verification** | feedback inside the loop | a `verify` green-gate (lint + typecheck + test + build) |
| **Guardrails** | make it halt | max iterations, no-progress detection, $ budget, hooks |
| **Durability** | survive a restart | one git branch per task + Memory + state in the repo |
| **Orchestration** | loops supervising loops | the `Workflow` tool (dynamic agents) |

## The four non-negotiable rules (from the practitioners, not the hype)

1. **A loop is only as good as its feedback.** An open loop that writes code with
   no verification is a machine for generating confident mistakes. Every loop
   here must self-verify before it claims success.
2. **The reusable unit is a skill, not a prompt.** Loops that call sharp, named,
   tested skills compound. Loops that re-derive everything each tick just burn
   money. If we do something more than once, it becomes a skill.
3. **The loop must halt.** The expensive resource shifted from tokens to loop
   management. Every loop has three hard stops: a max iteration count,
   no-progress detection, and a token/dollar budget ceiling.
4. **Durability is explicit.** Terminals close, machines restart. State lives in
   git and Memory, never only in a running session.

## The altitude shift (what changes for the human)

The job did not vanish, it moved up an altitude: from writing the code to
writing the thing that writes the code. Someone still decides *what* to build,
talks to users, and coordinates. In this repo, that someone writes the loops and
reviews the PRs they open. The loops do the typing.

## Our north star for this repo

The product is a self-hosted AI workout tracker. But the **growth engine** is the
meta-story: *this repo maintains itself with documented loops.* Every loop we
build is also a piece of content. We optimize for: visible activity (PRs that
close issues), trustworthy output (green CI, human-reviewed merges), and a
playbook anyone can copy.
