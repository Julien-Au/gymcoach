# Autonomy log

Append-only journal of autonomous runs. Newest first. Each entry: what was decided and
why, what shipped, what was challenged by subagents, what was deferred to a human. Governed
by the charter in [`07-autonomy.md`](07-autonomy.md).

---

## 2026-06-08 - First product run (catalog + content)

**Context.** Maintainer loop running unsupervised under the charter. Goal: drain ready PRs,
then improve the product, challenging each non-trivial change with a subagent.

**Decided / shipped.**
- Shipped #11 (Closes #4): expanded the seed exercise catalog by 25 movements and filled the
  two muscle groups that had zero coverage (FOREARMS, LOWER_BACK); strengthened the catalog
  test to assert valid enum membership and full-group coverage.
- Content loop (this PR): recorded the now-merged demo-credentials (#6) and catalog (#4)
  features in CHANGELOG, updated the loop-infra line, and logged this run.

**Challenged.** An independent skeptic subagent reviewed the #4 diff and caught a real
mis-classification (Hammer curl tagged FOREARMS; brachialis/biceps are the prime movers).
Fixed to BICEPS before push, then re-verified. The author did not grade its own homework.

**Deferred to human.** None.

**Next.** #5 (polish empty states) with subagent review; then scope #1 (imperial units,
larger, additive only). Triage if the backlog empties.

---

## 2026-06-08 - Bootstrap autonomy

**Context.** Operator switched the repo to a full-autonomy experiment: improve the product
continuously, no per-change approval, self-challenge with subagents, keep a rollback point.

**Decided / shipped.**
- Tagged rollback baseline `autonomy-baseline-2026-06-08` on `main` (post #6/#7 merge) and
  pushed it. Restore with `git checkout autonomy-baseline-2026-06-08`.
- Wrote the autonomy charter (`07-autonomy.md`): mandate, hard guardrails, the
  stop-and-leave-for-human list, the subagent challenge protocol, budgets, this journal.
- Allowed `git tag *` in `.claude/settings.json` so future runs can re-baseline.

**Earlier this session (pre-charter, for the record).**
- Built the end-to-end loop system (PR #9, open): `triage`, `ship-pr`, `write-up` skills +
  `docs/loops/03-06`.
- `implement-issue` produced PR #7 (CHANGELOG); `ship-pr` was dogfooded live and merged #7
  and #6 (closing issues #3 and #2) on green CI.

**Challenged.** Not yet - subagent review protocol starts with the next product change.

**Deferred to human.** None.

**Next.** Merge #9 once green; then work the backlog (#4 seed catalog, #5 empty states,
#1 imperial units), each subagent-challenged before merge per the protocol.
