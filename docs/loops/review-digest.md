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

---

## 2026-06-10 (later) - fourth ideate batch under the directive (#103-#105) + the review-driven fixes (#108/#109)

Merged: #102 (ideate log), #103 (bodyweight tracking - new table + API + card), #104 (coach
payload gains goals + fatigue), #105 (Strong CSV import - the biggest new surface to date),
#108 (import hardening: streamed body cap, transaction timeout, CSV formula-injection fix),
#109 (bodyweight sync race + bounds). All three features were flagged "needs post-merge
independent review" by the implementing tick (L8) and got it; the reviews produced #108 and
#109. This batch ranks **high**: untrusted file input, a new table, and a write-path fix.

**Read first, in order:**

1. **#105 + #108 together - the import pipeline.** `gh pr diff 105`, then `gh pr diff 108`.
   Untrusted CSV -> parser caps/Zod -> dry-run plan -> one transaction. #108 is what the
   security lens changed: a chunked body could bypass the 5 MB header check (now a streamed
   cap in parseJsonBody), Prisma's 5 s default would abort big legit imports (now 60 s),
   and imported names could plant spreadsheet formulas in the CSV export (now neutralized
   in lib/csv.ts).
2. **#103 + #109 - the bodyweight sync invariant.** `gh pr diff 103`, then `gh pr diff 109`.
   User.bodyweight is now a mirror of the newest entry, kept in sync under a user-row lock;
   #109 is the race the reviewer caught (POST trusted "stamped now = newest").
3. **#104 - what the coach now knows.** `gh pr diff 104`. Input-side only: goals with
   progress, stalled lifts, the deload recommendation. The adjustments output contract is
   untouched (verdict CLEAN) - but the coach's advice will now reference goals, so read the
   prompt addition.

**Skim:** the README/media refresh in the write-up PR (new screenshots + re-recorded GIFs
showing the current product; demo seed extended with bodyweight/goal/readiness data).

> The L8 backstop is now proven twice: independent post-merge review found one REAL defect
> in #95 and four across #103/#105. Author self-review keeps missing what independent eyes
> catch in one pass.

---

## 2026-06-11 - fifth batch (#115/#116/#117): three CLEAN verdicts, first zero-defect batch

Merged: #114 (ideate log), #115 (one-tap deload week - migration + progression + API),
#116 (ask the coach mid-session - live session context in the chat payload), #117 (Hevy
CSV import on the hardened pipeline). All three were flagged for post-merge independent
review (L8) and all three came back CLEAN - the first batch with zero REAL defects. Also
the first batch under the model-routing directive (Fable implements, Opus reviews).

**Read first, in order:**

1. **#115 - the deload precedence rule.** `gh pr diff 115`. suggestNextWeight now has a
   planned-deload branch that pre-empts progression AND readiness adjustments (one 10%
   step-down, never stacked). This changes what weight the app tells you to lift - the
   reviewer verified every branch, but it is core training behavior, worth your eyes.
2. **#116 - what the chat can see now.** `gh pr diff 116`. A sessionId query param attaches
   your live workout to the chat payload; two independent ownership gates (page + API),
   foreign ids degrade to null. The structured contracts are byte-identical.
3. **#117 - the import surface doubled.** `gh pr diff 117`. New Hevy parser + shared
   executor refactor; the Strong path is pinned byte-identical by a regression test and
   the rate-limit bucket is genuinely shared across both routes.

**Skim:** #114 and this write-up. **Follow-up filed:** #118 (latent doc-vs-validation
contradiction on negative assisted loads - unreachable today, option-A doc fix specced).

> Screenshots note: none of the four captured pages (home/progress/generator/catalog)
> visibly changed in this batch (the new surfaces live in the session runner, the chat,
> and settings), and the GIFs were re-recorded yesterday - so per the media rule (refresh
> on visible change; clips max ~3 batches lag) the media stands as-is at 1 batch of lag.

---

## 2026-06-12 - the conditioning batch (#137-#139, fix #141): cardio becomes first-class

Merged: #137 (cardio sets: additive migration, Zod cross-field rule, logging UI, offline
path), #138 (importers map cardio rows), #139 (conditioning card), #141 (the one REAL
review finding: coach payload no longer counts cardio as strength signals), plus #132
earlier (docker-smoke CI job, reviewed CLEAN). This is the first batch on the broadened
training/fitness vision. All three feature reviews ran on Opus per the model-routing
directive; the #137 reviewer ran the flow live (logged 30:00 / 5 km on a production
build and read it back) and threw adversarial Zod probes; the #138 reviewer wrote 8
extra adversarial import probes - all passed.

**Read first, in order:**

1. **#137 - the schema and the exclusion contract.** `gh pr diff 137`. Two nullable
   columns + a CARDIO enum value, and the promise that cardio NEVER pollutes lifting
   math - verified exclusion-by-exclusion (stats, records, goals, MEV/MRV, stalls).
   This contract is what every future conditioning feature builds on.
2. **#141 - the one place the contract leaked.** `gh pr diff 141`. weekSummary fed
   cardio to the LLM as phantom 0-volume lifts; now excluded, pinned by an
   integration test. Proof the L8 review lane still earns its cost (4 batches, 6 REAL
   findings, all caught before users).
3. **#138 - untrusted cardio numbers.** `gh pr diff 138`. Duration/distance bounds
   shared with the API schema, applied after unit conversion; strength dup-keys pinned
   byte-identical.

**Skim:** #139 (display-only card; review CLEAN with two cosmetic NITs: the pre-existing
local-vs-UTC ISO-week doc mismatch repo-wide, and the warmup-only-cardio empty card),
this write-up (incl. demo seed gaining 23 deterministic cardio sessions + fresh
screenshots).
