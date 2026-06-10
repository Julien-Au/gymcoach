# Review digest (read this, so your understanding does not rot)

The loop ships faster than any human reads. That gap is **comprehension debt**: the more the
loop merges that you did not read, the less you actually understand your own product. This
file is the antidote - after each batch, `write-up` appends a short, **prioritized reading
list**: what merged, and which few diffs are worth your eyes *first*, ranked by risk x
impact. The skeptic sub-agents already gate correctness; this keeps the *human* in the loop.

Priority rule: **auth/security, schema/migrations, core behavior (progression/stats), LLM
prompts, and CI/pipeline rank highest** (a wrong call there is expensive and quiet).
Additive UI, tests, and docs rank lowest (a reviewer/skeptic + the gate catch most of it).
Read a diff with `gh pr diff <n>`.

---

## 2026-06-09 - second ideate batch (#84/#85/#86): analytics + UI on lib/stats.ts

Three additive, derived-on-read features shipped (issues #80/#81/#82): personal records on the
post-session summary (#84), MEV/MRV volume landmarks (#85), and stalled-lift detection (#86).
No schema, no migration, no auth/prompt change - so this batch ranks **modest**. The one read
worth your time:

1. **#85 + #86 - the new `lib/stats.ts` helpers (core behavior).** `gh pr diff 86` then
   `gh pr diff 85`. Several features now share this file: `isStalled` (e1RM flat over the last
   `STALL_LOOKBACK_SESSIONS=3` within `STALL_TOLERANCE=0.5%`), `classifyWeeklySets` /
   `WEEKLY_SETS_MEV=10` / `WEEKLY_SETS_MRV=20`, and `weeklySetsByMuscleGroup`. These are pure
   functions that drive what users are told about their training; read the thresholds and the
   "needs >= 3 sessions to flag" / inclusive-band edges. (Note: #81 and #82 both edited this
   file and overlapped - see L7; the merged result is what the gate ran on.)

**Skim (additive UI - lower risk):** #84 personal-records card (`computeSessionPRs` in
`components/session/session-summary.tsx`, reuses `detectPRs` with a "since last session"
baseline) and the two new progress-dashboard cards. Each is display-only, tested, and
skeptic-reviewed; read the helper only if the numbers matter to you, skip the wiring.

---

## 2026-06-09 - the big autonomous session (~27 merges)

A lot shipped today. You do not need to read all of it. Read these **six first** - they
touch auth, the security model, what weights users are told to lift, the AI's behavior, the
database, and the pipeline:

1. **#66 - bcrypt 5 -> 6 (auth).** `gh pr diff 66`. Password hashing for register/login. The
   bcrypt API is unchanged and the auth E2E passed, but this is the one change that can lock
   every user out if wrong. Confirm `bcrypt.hash`/`bcrypt.compare` usage is intact.
2. **#56 - public-repo guardrail (security/trust model).** `gh pr diff 56`. Defines *who the
   loop trusts* (login allowlist `{JulienAu, Julien-Au}`), prompt-injection refusal, and the
   `curl`/`wget` deny. This is the boundary that keeps an open repo from steering the loop.
   Make sure the trust model is the one you want.
3. **#55 - readiness -> deterministic progression.** `gh pr diff 55`. `lib/progression.ts`
   now lets soreness/readiness *hold or reduce* the suggested weight (never raise it),
   backward-compatible. This changes the actual numbers a user is told to lift - read the
   thresholds and the never-raises invariant.
4. **#44 - coach prompt positioning.** `gh pr diff 44`. `lib/prompts/*`: the AI coach is
   instructed to advise *within* the user's program and explain why, never silently rewrite.
   Prompt wording is product behavior; read what the model is now told to do.
5. **#43 - readiness/soreness check-in (schema + API).** `gh pr diff 43`. New
   `ReadinessCheckin` Prisma model + `/api/readiness` (Zod-validated). The only new
   data/table this session - confirm the model and validation.
6. **#67 - CI modernization.** `gh pr diff 67`. `.github/workflows/ci.yml`: actions ->@v5
   (Node 24 runtime), node-version 20->22, Postgres from the ECR Public mirror. Pipeline
   changes affect every future merge's trust gate.

**Skim (additive features - logic + UI + tests, lower risk):** #41 plate calculator, #42 &
#62 program templates, #51 soreness/note UI, #63 readiness explainability badge, #64
readiness opt-out preference, #75 warm-up calculator, #76 personal-record badge, #77
training-consistency card. Each is additive, tested, and skeptic-reviewed; read the `lib/*`
helper if the behavior matters to you, skip the wiring.

**Trust the gate (docs / tests / in-range deps - no close read needed):** the loop-infra
docs #68 (ideation loop) and #74 (memory/learning architecture) are worth reading as
*narrative* if you want to understand how the loop now works; the changelog/log docs
(#46/#50/#52/#58/#65/#73/#78), the readiness route tests #49, and the in-range dep bumps #45
are safe to skip.

> Honest note: the skeptics reviewed all of the above, but "reviewed by another agent" is
> not "understood by you". If you read only six diffs from today, read the six above.

---

## 2026-06-10 - third ideate batch + the complex-features directive (#92-#95, #97)

Merged this batch: #91 (ideate log), #92 (charter widened to complex features), #93
(deload-week banner), #94 (set-logging shorthand), #95 (per-exercise target goals - first
feature under the new directive: additive migration + API + UI), #97 (fix: re-derive goal
achievement when the achieving set is deleted). This batch ranks **high**: it contains a
governance change, a new table + API surface, and a write-path fix.

**Read first, in order:**

1. **#92 - the autonomy charter now allows complex features without human review.**
   `gh pr diff 92`. Governance, not code: the stop-for-human list narrowed to destructive
   migrations / auth-security / major dep bumps, traded for reinforced non-regression
   controls. This changes what the loop is allowed to merge from now on - read it even if
   you read nothing else.
2. **#95 - per-exercise goals (schema + API + write-path hook).** `gh pr diff 95`. New
   `ExerciseGoal` table (additive, unique per user+exercise), Zod-validated ownership-scoped
   routes, and a best-effort achievement stamp inside the set-save path. The post-merge
   independent review verified ownership, migration drift, and e1RM math; still the largest
   new surface this batch.
3. **#97 - the defect that review found.** `gh pr diff 97`. Set DELETE now re-derives
   `achievedAt` from remaining history. Read it as the concrete failure mode of #95's
   lifecycle (and the proof the post-merge backstop works - see lessons.md L8).
4. **#93 - deload recommendation thresholds.** `gh pr diff 93`. `lib/deload.ts` constants
   (2 stalled lifts; readiness average <= 2/5 over <= 5 check-ins, 14-day window) decide
   when the app tells a user to back off - sanity-check the coaching judgment.

**Skim (additive, tested, skeptic-reviewed):** #94 shorthand parser (`lib/set-shorthand.ts`;
note RPE -> RIR mapping = 10 - RPE clamped to 0-5), #91 and the docs in this PR.

> Honest note: #95 merged on the implementing agent's own review pass (no subagent tool in
> its environment); the independent review happened post-merge and found #97. The protocol
> now requires flagging that case explicitly (charter, L8).
