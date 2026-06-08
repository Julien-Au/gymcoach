# 02 — The Issue -> PR loop (our flagship)

The first loop we run. It turns open issues into reviewable pull requests, on its
own, with self-verification. It is the most visible proof: PRs that close issues are
public activity that attracts contributors and stars.

## The body is one sentence

Because the foundations (`01`) did the hard work, the loop itself is tiny:

> pick the next actionable issue -> run the `implement-issue` skill -> stop when done.

## Running it locally (phase 1: you watch)

First, make sure the new config is loaded (restart the session or open `/hooks`
once). Then fire:

```
/loop Pick the next open "good first issue" that has no PR yet and run the
implement-issue skill on it. After each PR, move to the next issue. STOP when there
are no actionable issues left, OR you have opened 3 PRs in this run, OR a run hits a
stop condition (ambiguous issue, or red green-gate after 3 fix attempts). Never
merge - a human reviews.
```

`/loop` self-paces: it does one iteration, decides if it should continue, and
schedules the next. You watch the first PR appear, sanity-check it, and learn the
mechanics before letting it run unattended.

You can also dry-run a single iteration without the loop by invoking the skill
directly: `/implement-issue 2` (implement issue #2 only).

## The three hard stops (so it always halts)

> "Without guardrails, you get infinite loops and billing surprises orders of
> magnitude over budget." The expensive resource is now loop management.

This loop encodes all three:

1. **Max iterations** - "open at most 3 PRs in this run". Raise it once you trust it.
2. **No-progress detection** - "stop when there are no actionable issues left", and
   the skill stops a run that hits an ambiguous issue or a red gate after 3 tries.
3. **Budget ceiling** - start the turn with a token target (e.g. prefix your message
   with a `+300k` budget) so the loop cannot run past it.

## Graduating to the cloud (phase 2: it runs while you sleep)

Once the local loop is trustworthy, move it onto infrastructure time:

- Flip permissions to `bypassPermissions` for the unattended run (it cannot pause to
  ask). Keep the `deny` list - it still blocks the destructive ops.
- Use `/schedule` to run the same prompt on a cron (e.g. nightly). State lives in git
  (one branch per task) and on GitHub (the PRs), so a crash loses nothing.
- Keep the green-gate as the trust boundary: nothing opens a PR on a red gate, and a
  human still merges.

This is the Boris/Steinberger shape: you wrote the loop and the stopping behavior;
the agent does the typing; it runs on cron; and most of the engineering is making
sure it halts and checks itself.

## What to watch on the first runs

- Did the PR actually pass the gate? (the body must say so, and CI confirms)
- Is the change minimal and conventional (commit style, tests added)?
- Did it stop cleanly when it should, instead of thrashing?

Tighten the skill (`.claude/skills/implement-issue/SKILL.md`) whenever you see a
failure mode - that is how the asset compounds.
