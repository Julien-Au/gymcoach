# 04 — The ship loop (CI-watch + auto-merge)

`implement-issue` opens a PR and then, by design, stops: "never merge - a human reviews".
That human is the last manual step in the pipeline. The ship loop removes it **safely**:
it watches the PR's CI, fixes a red gate within bounds, self-reviews the diff, and
**auto-merges on green**. This is the shipping half - the CI-watch and merge stages of the
pipeline, in one reusable skill (`.claude/skills/ship-pr/`).

## The autonomy boundary (the decision that defines this loop)

Auto-merge is allowed **only** when CI is green and the self-review is clean. The green CI
is the trust boundary. The loop never merges around it:

- never merge while a required check is **red or pending**;
- never merge a **draft**, a `CHANGES_REQUESTED` PR, or one not targeting `main`;
- PRs only - nothing ever lands on `main` directly;
- the inherited deny-list (no force-push, no hard reset) still holds.

This is why local-only verification is not enough: `scripts/verify.sh` covers
lint/type/unit/build, but integration + E2E run **only in CI**. The ship loop is where the
full gate actually gates a merge.

## The body is one sentence

> for each ready PR: watch CI -> if red, fix (<=3 tries) -> self-review -> merge on green.

## Running it

```
/loop Run the ship-pr skill on the open, non-draft PRs that target main. Watch CI, fix a
red gate up to 3 times, self-review, and squash-merge any PR that is green and clean.
STOP when there are no ready PRs, or a PR is still red after 3 fix attempts (leave a
comment and move on). Never merge on a red or pending gate.
```

## The three hard stops

1. **Max fix attempts** - 3 per PR, then comment the blocker and stop. No thrashing on a
   genuinely broken change.
2. **No-progress detection** - a stuck-pending CI or a PR that fails the skip checks is
   reported, not forced through.
3. **Budget ceiling** - token target on the turn.

## Fixing a red gate

Reproduce locally with the matching gate tier (`bash scripts/verify.sh`, or `--full` for
integration/E2E), read the real error with `gh run view --log-failed`, fix the **cause**
on the PR branch, re-verify, push. Each fix counts against the 3-attempt budget so a
flaky-looking failure cannot loop forever.

## How it chains

`implement-issue` (`02`) and `write-up` (`05`) both produce PRs; the ship loop merges
both. After each merge it re-checks the next PR's CI, because `main` just moved. Merged
work then becomes the raw material for the content loop (`05`).
