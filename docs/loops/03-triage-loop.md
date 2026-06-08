# 03 — The triage loop (keep the backlog fed)

The Issue -> PR loop has a fatal flaw on its own: it stops when there is "no actionable
issue left". A self-maintaining repo cannot wait for a human to write issues. The triage
loop is the **head of the pipeline** - it manufactures well-scoped work from the state of
the repo so the machine never starves.

## The body is one sentence

> survey the repo for real, actionable work -> file up to 3 focused issues -> stop.

The discipline lives in the `triage` skill (`.claude/skills/triage/`): where to look
(code TODOs, roadmap gaps, coverage holes, small UX/polish, dep hygiene), how to scope
(small, self-contained, green-gate-verifiable), and how not to spam (de-dupe against open
issues, cap at 3, file nothing rather than invent busywork).

## Running it

```
/loop Run the triage skill. Find real, non-duplicate, single-PR-sized work and file at
most 3 issues. If the backlog is already healthy, file nothing and say so. STOP after
one triage pass.
```

## The three hard stops

1. **Max output** - at most 3 issues per run.
2. **No-progress / no-invention** - nothing actionable and non-duplicate found means file
   nothing. Triage must be allowed to do nothing; that is the guardrail against a tracker
   full of make-work.
3. **Budget ceiling** - a token target on the turn, like every loop.

## Why issues, not code

Triage deliberately stops at the issue. Separating *deciding what to do* from *doing it*
keeps each loop sharp and each unit tested: the triage loop's output (a crisp issue) is
exactly the Issue -> PR loop's input. Two simple loops that compose beat one loop that
tries to do both and does neither well.

## How it chains

`triage` (this) -> `implement-issue` (`02`) -> `ship-pr` (`04`) -> `write-up` (`05`). The
orchestration loop (`06`) runs triage only when the backlog is low, so the tracker stays
useful instead of flooded.
