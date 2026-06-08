# Autonomy log

Append-only journal of autonomous runs. Newest first. Each entry: what was decided and
why, what shipped, what was challenged by subagents, what was deferred to a human. Governed
by the charter in [`07-autonomy.md`](07-autonomy.md).

---

## 2026-06-08 - Imperial units complete + backlog refilled

**Context.** Close out issue #1 and keep the pipeline fed.

**Decided / shipped.**
- Shipped #17 (Closes #1): converted the progress page (line chart, weekly-volume bars,
  recap table) to the user's unit by converting the plotted data, not just labels. #1 is
  now fully delivered across #14 (foundation), #15 (logging/history), #17 (charts).
- Noticed #1 had auto-closed early (the progress charts were still kg, so the acceptance
  was not met) and **reopened it** before finishing, rather than leave a half-done issue
  marked done. Truth over green checkmarks.
- Triage refilled the backlog (no TODO/FIXME markers exist, so coverage was the real gap):
  #18 (Zod schema validation tests), #19 (unit-agnostic set-note placeholder), #20
  (integration tests for getLastPerformances).

**Challenged.** Independent skeptic subagent on #17: READY, kg output verified
byte-identical, no double-conversion or mixed units.

**Deferred to human.** None. The AI coach intentionally stays in kg (matches its own
prompt/prose); localizing it would need a prompt-design decision, so it was not forced.

**Next.** #19 (fast win) then #18, each subagent-reviewed; #20 (integration tier) after.
Keep the README/docs/loops démarche current - the growth engine is stars.

---

## 2026-06-08 - Empty states + imperial units (split delivery)

**Context.** Continuing the maintainer loop through the backlog (#5, #1).

**Decided / shipped.**
- Shipped #5 (empty states): a reusable `EmptyState` primitive + friendly empty states
  with a CTA on the progress and history pages. Subagent review: READY.
- Issue #1 (imperial units) was deliberately **split** - the full conversion across every
  surface plus input was too large/regression-prone for one safe PR (charter: split when
  too large). PR #14 (foundation: WeightUnit enum, additive migration, `lib/units.ts`,
  profile API) merged. PR #15 (UX: settings toggle + logging/history conversion) opened.
  Progress charts follow in a third PR that closes #1; the AI coach stays in kg to match
  its own prompt/prose.
- Content/README pass (this PR): added a "this repo largely maintains itself" section to
  the README (the démarche is the growth engine), recorded empty states + the unit
  preference in the CHANGELOG, and logged this run.

**Challenged.** Subagents reviewed every product change. On #1 PR #15 the skeptic caught a
**real silent regression**: rendering raw stored weights via `decimals:1` would have
rounded `82.25 kg -> 82.3 kg` for existing kg users. Fixed to `{decimals:2, group:false}`
(byte-identical to the old raw render) and verified by a second review pass. This is the
adversarial loop earning its keep.

**Deferred to human.** None. Progress-chart conversion and a possible coach localization
are tracked as follow-up work, not blockers.

**Next.** Merge #15 on green, then PR #3-of-#1 (progress charts) to close #1; triage to
refill the backlog once empty.

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
