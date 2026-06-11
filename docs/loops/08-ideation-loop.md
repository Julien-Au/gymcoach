# 08 — Ideation loop (so the product, not just the repo, keeps growing)

`triage` (03) keeps the backlog fed with **code-health** work - tests, small bugs, deps.
But a repo that only tidies itself plateaus. The ideation loop is the head *above* triage:
when even triage comes up dry, it manufactures **product** work - well-scoped feature ideas
- so the Issue -> PR loop never starves for *direction*, and the product keeps moving
toward the goal of being the most complete self-hosted AI training/fitness app.

It is the cheap, recurring cousin of the one-off deep-research workflow we ran once to seed
the roadmap (captured in Memory `research-product-direction.md`). That workflow spent ~100
agents in a single pass; ideation must run *every time the loop would idle*, so it is
deliberately tiny.

```
        backlog empty?
   triage (03) finds no code-health work
              |
              v
        ideate (08) -- bounded brainstorm + optional small web check
              |  files <= 3 crisp, single-PR feature issues (labels: enhancement, idea)
              v
   implement-issue (02) -> ship-pr (04) -> write-up (05)
              |
        drains the idea backlog; only when empty again does ideate fire
```

## Where it sits in the maintainer loop

The decision order (see `06-orchestration.md`) becomes: **ship -> triage (if low) -> if
still no actionable issue, ideate -> implement -> write-up -> stop on a clean idle.**
Ideation fires only after ship and triage have nothing and there is no open actionable
issue. That ordering is the rate-limiter: ideas are only manufactured when the loop would
otherwise stop, and implementation drains them before more are made.

## The budget (why it does not explode in tokens)

The skill (`.claude/skills/ideate/SKILL.md`) bakes in hard limits:

- **Never** the heavy deep-research workflow. Brainstorming from existing context (repo,
  research memory, roadmap) is the default; a web check is optional and capped at ~6
  searches.
- **At most 3 issues per run**, and **no run at all** while there are already >= 3 open
  `enhancement`/`idea` issues (anti-flood).
- One productive run per starved cycle.

So the cost per idle cycle is roughly one focused brainstorming pass, not a research
campaign - and the anti-flood cap means it cannot outrun the implement/ship half.

## Grounding (ideas are derived, not hallucinated)

Ideas come from the product vision, the captured competitor research and its wedge (AI that
advises within the user's program, explains why, respects ownership), the current feature
set (find the gaps and the next slice of what shipped), the README roadmap, and an optional
small web check. Each filed idea encodes a **sensible default product decision** so it is
concrete, single-PR work rather than "needs a product call".

## Guardrails

Ideation only *files issues* - it never writes product code or merges. The issues it files
are authored by the loop's own trusted account, so they are auto-actionable, but they are
still subject to everything downstream: the green-gate, the subagent challenge, and the
stop-for-human list. Since the 2026-06-10 operator directive, complex ideas (data-safe
migrations, LLM-output-contract changes, multi-surface features) are implementable without
human review under the charter's reinforced non-regression controls; only destructive data
migrations, auth/security changes, and major dep bumps still get a draft PR for a human.
`docs/loops/ideas-backlog.md` is the durable log of proposed / shipped / rejected ideas, so
the loop never repeats itself.

## The four rules, here

1. **Feedback** - a filed idea is only "good" once `implement-issue` can finish it under the
   green-gate; vague epics fail that test and are not filed.
2. **Skills, not prompts** - ideation is the `ideate` skill; the maintainer loop just calls
   it when starved.
3. **It must halt** - <= 3 issues per run, no run while >= 3 idea issues are open, one run
   per starved cycle. Three caps.
4. **Durability** - ideas live as GitHub issues + `ideas-backlog.md`, not in a session.
