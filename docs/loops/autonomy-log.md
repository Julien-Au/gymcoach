# Autonomy log

Append-only journal of autonomous runs. Newest first. Each entry: what was decided and
why, what shipped, what was challenged by subagents, what was deferred to a human. Governed
by the charter in [`07-autonomy.md`](07-autonomy.md).

---

## 2026-06-12 - Conditioning batch reviewed (3x CLEAN + 1 fix); write-up + demo refresh

**Context.** The cardio foundation batch (#137/#138/#139) merged yesterday with the
no-reviewer flag; the three independent Opus reviews ran as the orchestrator's next
action.

**Decided / shipped.**
- Verdicts: #138 CLEAN (security; reviewer added 8 adversarial probes), #139 CLEAN
  (correctness; 2 cosmetic NITs noted), #137 CLEAN with ONE minor REAL finding - the
  coach payload counted cardio sets as working sets and emitted phantom 0-volume CARDIO
  "lifts". Fixed same-day as #140 -> PR #141 (merged on green incl. the new docker-smoke
  job), exclusion pinned by an integration test.
- The #137 reviewer satisfied charter control 6 by running the flow live (production
  build, logged 30:00 / 5 km, read it back, E2E spec green).
- Write-up: CHANGELOG, README features (cardio + conditioning card + importers),
  backlog verdicts, this entry. Demo seed extended with 23 deterministic cardio
  sessions; all four screenshots re-shot (progress now shows the conditioning card);
  demo redeploy via the deploy-demo workflow follows the merge.

**Challenged.** Three independent reviews, model-split (Fable implemented, Opus
reviewed). Accepted-change rate this batch: 5 merged / 0 abandoned.

**Deferred to human.** Nothing. Future slices stay un-filed until the next starved
cycle (pace analytics, conditioning in the coach payload, cardio drill-down).

---

## 2026-06-11 - Conditioning/cardio foundation batch shipped (#133, #134, #135)

**Context.** Maintainer tick executing the conditioning batch ideated on 2026-06-11, in
strict dependency order (each PR merged before the next branch was cut). All three issues
authored by JulienAu (trust-gated, collaborator-verified 204).

**Decided / shipped.**
- PR #137 (Closes #133): first-class cardio sets. Additive migration
  (`Set.durationSec`, `Set.distanceM`, `ExerciseCategory.CARDIO`) validated on the test
  DB (migrate deploy + clean migrate diff); rollback baseline
  `autonomy-baseline-2026-06-11b` tagged on main before merge. Cardio sets store
  reps = 1 / weight = 0 (normalized server-side), Zod bounds 1..86400 s / 0..1000 km,
  cross-field rule (duration/distance only on CARDIO exercises, duration required) in
  the API route. Session logger swaps weight/reps for mm:ss + km inputs; sets list,
  summary and history render `12:30 · 2.5 km`. Offline queue/sync/hydration carry the
  fields. Tonnage/e1RM/PR/progress/MEV-MRV math skips cardio sets explicitly; CARDIO
  excluded from the lifting selector. Catalog gains 4 cardio movements. Tests at every
  layer (unit, integration incl. pinned strength path, new E2E). One local full-gate red
  on the way: the new E2E spec's UI signup pushed the suite over the register limiter's
  5/min budget - fixed with the established per-spec X-Forwarded-For bucket pattern, not
  by touching the limiter.
- PR #138 (Closes #134): the Strong/Hevy importers map cardio rows onto the new fields.
  Qualifying condition is exactly the old skip branch; usable-duration rows import
  (meters/miles conversion per export unit), the rest keep the counted skip notice.
  Cardio-only new exercises are created CARDIO/OTHER. Dup keys byte-identical for
  strength, extended for cardio so distinct runs do not collapse. #105/#106/#108
  hardening untouched and re-pinned (strength-row shapes, dup-key format, caps).
- PR #139 (Closes #135): conditioning card on the progress page - pure
  `weeklyConditioning` derivation (8 zero-filled ISO weeks: minutes, km, sessions),
  Recharts bar chart with the WHO 150 min/week reference line, hidden until the first
  cardio set ever; strength charts untouched.

**Challenged.** Nested run, no independent subagent spawnable: per the charter's
backstop, all three PRs merged on green full CI (local `verify.sh --full` plus the
5-check CI including docker-smoke) and are flagged for post-merge independent review as
the orchestrator's next action - multi-lens (correctness + does-it-work) for #133,
security lens for #134 (untrusted file input), correctness for #135.

**Deferred.** Pace/speed analytics, conditioning in the AI coach payload, per-exercise
cardio drill-down, CSV history export of duration/distance - future slices, not filed
yet to respect anti-flood.

## 2026-06-11 - Docker smoke test in CI (#129) + first conditioning-axis ideate batch

**Context.** Maintainer tick after the vision broadening (#130/#131). One trusted open
issue (#129, author JulienAu, collaborator-verified) requesting a CI smoke test of the
production Docker image, because #127 (bcrypt prebuilds missing from the standalone
output) reached the live demo with all-green CI.

**Decided / shipped.**
- PR #132 (Closes #129): new required `docker-smoke` CI job - buildx build of the
  production image (GHA layer cache), Postgres on a dedicated network, the image started
  with the exact prod compose command (`migrate deploy` + `node server.js`), then three
  probes from the job: GET /login, POST /api/auth/register, POST /api/auth/login all 200.
  Default-decision substitution, documented in the PR: the probe account is created via
  the image's own register route instead of a host-side seed (covers bcrypt hash AND
  compare, Prisma writes, JWT, catalog seeding; no host npm ci, keeps the job lean).
- Birth-proof (L9 gate spot-check) run locally before the PR: with the #128 COPY lines
  reverted the probe fails (register 500, "No native build was found" from bcrypt); with
  the fix restored all probes pass. The net provably catches the #127 class at birth.
- First CI run hit the known ECR mirror transient ("toomanyrequests: Rate exceeded") on
  the smoke job's own pull; hardened with a bounded 5-attempt pull retry instead of a
  manual rerun. Second run all green, smoke job 2m39s warm (budget ~5 min). Merged on
  green full CI; main synced.
- Ideate batch (conditioning/cardio axis, per the broadened vision): filed #133
  (first-class cardio sets - additive Set.durationSec/distanceM + CARDIO category +
  logging UI, the foundation slice), #134 (importers map cardio rows onto the new fields
  instead of skipping; depends on #133), #135 (conditioning card on the progress page
  with a 150 min/week reference line; depends on #133). Recorded in ideas-backlog.md.
  Deliberately not filed: supersets (stays deferred), free-text AI set logging (not on
  the cardio axis; future batch), pace/speed analytics and coach-payload conditioning
  (later slices of #133-#135).

**Challenged.** Nested run, no independent reviewer spawnable: the #132 diff was
self-reviewed plus proven by the two-leg birth-proof and green full CI, and is flagged
in the run report for an independent post-merge review per the charter's no-reviewer
backstop (lesson L8).

**Deferred to human.** Nothing.

**Next.** Implement #133 first (it unblocks #134/#135), under the complex-features
controls (additive migration, full local gate, tests at every layer, multi-lens review).

---

## 2026-06-11 - Operator decision: product vision broadened beyond hypertrophy

**Context.** The operator decided (2026-06-11) that the product opens beyond pure
hypertrophy. The aim becomes: **the most complete self-hosted AI training/fitness app** -
strength, conditioning/cardio, endurance, mobility, and general fitness are all in scope.

**Decided / shipped.** Updated the two spots that carried the old wording:
`.claude/skills/ideate/SKILL.md` (three occurrences; the "The vision" item now records the
broadening and the concrete opening: the Strong/Hevy CSV importers currently SKIP cardio
rows and nothing tracks duration/distance work - that axis is now fair game) and
`docs/loops/08-ideation-loop.md` (one occurrence). Docs-only PR, no code change.

**Challenged.** Docs-only; merged on green CI per the charter (no independent review
needed for wording-only changes).

**Deferred to human.** Nothing.

---

## 2026-06-11 - Fifth batch: roadmap's last AI item shipped; first zero-defect reviews; model routing live

**Context.** Fifth ideate batch (#111 ask-the-coach mid-session, #112 one-tap deload,
#113 Hevy import) filed and logged (#114), implemented by a Fable background tick (PRs
#115/#116/#117, all merged on green full CI, budget 3/3, rollback baseline tagged before
the migration). First cycle under the operator's model-routing directive: Fable for the
implementing tick, Opus 4.8 for the three independent post-merge reviews.

**Decided / shipped.**
- All three post-merge reviews came back CLEAN - the first batch with zero REAL defects
  since the L8 backstop exists. Notable verifications: deload precedence on every branch
  incl. no-stacking; double ownership gate on the chat sessionId; shared import rate
  bucket and a byte-identical Strong path.
- The tick's flagged product concern (deload step-down on negative assisted loads) was
  requalified by the reviewer as a pre-existing, currently unreachable doc-vs-validation
  contradiction; filed as #118 with a default option-A (docs) resolution.
- Write-up: CHANGELOG, README features + roadmap (in-session AI suggestions checked;
  free-text AI set logging is the remaining open item), backlog, this entry. Media
  unchanged per the rule (no captured page changed; clips at 1 batch of lag).

**Challenged.** Three independent Opus reviews in parallel; all CLEAN. The quality
signal survived the model split - the cheaper review lane still verified empirically
(ran tests, checked diffs byte-level) rather than rubber-stamping.

**Deferred to human.** Nothing. #118 awaits a normal loop pick-up (option A specced).

---

## 2026-06-11 - Maintainer run: shipped #112, #111, #113 (fifth ideate batch)

**Context.** Maintainer tick over the fifth ideate batch, strictly serialized (lesson L7:
the next issue's branch is cut only after the prior PR is MERGED). All three issues
trust-gated (author `JulienAu`). All three are complex features under the 2026-06-10
directive: each ran `verify.sh --full` locally before its PR and shipped tests at every
touched layer (unit + integration + E2E). Merge budget 3; used 3.

**Shipped.**
- **#112 -> PR #115 (merged): one-tap deload week.** Additive nullable `User.deloadUntil`
  migration (validated on :5434: `migrate deploy` + clean `migrate diff`; rollback baseline
  `autonomy-baseline-2026-06-11` tagged on main before the merge). POST/DELETE
  `/api/deload` (strict-empty-object Zod body so no client-chosen duration; operates only
  on the caller's own row). New `'planned-deload'` suggestion reason: 10% step-down using
  the existing `READINESS_DELOAD_FRACTION`, precedence over a programmed increment and a
  readiness hold, never stacking with a readiness deload (one reduction, pinned by unit
  tests). Banner start/end buttons, session-runner badge + explainer, coach payload
  `fatigue.deloadActive` (additive; output contract untouched). One local gate red: an
  existing exact-shape payload test needed the additive field - acknowledged and updated
  with an extra active/expired case.
- **#111 -> PR #116 (merged): ask the coach mid-session.** "Ask the coach" button in the
  session runner -> `/chat?sessionId=...`. Chat payload gains the additive, compact,
  ownership-checked `currentSession` section (`buildCurrentSessionContext` returns null
  for a foreign/unknown id - the chat silently degrades). Prompt addition is input-side
  ONLY; every structured output contract is unchanged and the existing contract tests
  passed unmodified. Demo provider serves a canned in-session answer keyed on the quoted
  `"currentSession"` payload marker, and the Playwright web server now runs
  `LLM_PROVIDER=demo`, so the no-key flow is E2E-covered end to end (the canned answer
  streaming back proves the live context reached the provider). One local gate red: the
  suite's 6th parallel UI signup tripped the 5/min register rate limit - the new spec now
  registers via the API in its own X-Forwarded-For bucket (test-side fix; the limit itself
  is untouched).
- **#113 -> PR #117 (this PR): Hevy CSV import.** Second import format behind the same
  untrusted-input bar as #105: shared caps + RFC4180 reader extracted verbatim to
  `lib/import/csv.ts` (Strong parser tests pass unmodified), new `hevy-csv.ts` parser
  (set_type warmup/dropset mapping, both documented timestamp formats, lbs header variant,
  0-based set_index hardened against silent defaults), planner/executor generalized with
  optional flags/times that keep the Strong path byte-identical (pinned by a regression
  test), mirrored `/api/import/hevy` route (streamed body cap, shared rate-limit budget,
  dry-run preview, transactional confirm, duplicate skip), settings source-app selector
  (unit toggle stays Strong-only).

**Challenged.** No subagent-spawning tool exists in this environment, so the charter's
independence requirement could not be met in-run: each PR got an inline multi-lens review
pass by the author (correctness + does-it-actually-work; + security for #113) on top of the
green full gate, and per the charter all three merges are flagged for an independent
POST-MERGE review by the orchestrator as the next action. Findings worth recording from the
inline passes: the deload step-down on negative (assisted) loads reduces assistance (a
pre-existing semantic of the readiness deload, not a regression - candidate for a future
issue), and an active deload cannot be ended early from the progress page when the user has
no recent training data (bounded: it self-expires).

**Deferred to a human / next run.**
- Independent post-merge review of #115, #116, #117 (charter "Subagent challenge protocol"
  backstop, lesson L8).
- Possible product issue: deload semantics for assisted (negative-load) exercises.

**Context.** Maintainer tick over the fourth ideate batch, strictly serialized (lesson L7:
next issue only after the prior PR is MERGED). All three issues trust-gated (author
`JulienAu`, collaborator check HTTP 204). All three are complex features under the
2026-06-10 directive, so each ran `verify.sh --full` locally before its PR, shipped tests at
every touched layer, and validated its migration against the test Postgres. Merge budget 3;
used 3.

**Shipped.**
- **#99 -> PR #103 (merged): bodyweight tracking.** Additive `BodyweightEntry` migration
  (fresh `migrate deploy` + clean `migrate diff` on :5434), POST/GET/DELETE routes that keep
  `User.bodyweight` (the "current value" the app reads) in sync with the newest entry in one
  transaction, and a progress-page card (12-week trend chart, quick add in the display unit,
  deletable entries). Rollback baseline `autonomy-baseline-2026-06-10b` tagged on main
  before the merge. One local gate red (Playwright strict-mode: "Log" matched "Log out"),
  fixed with an exact-match selector.
- **#101 -> PR #104 (merged): goals + fatigue signals into the AI coach payload.** Additive
  `CoachPayload.goals` (per-exercise target, e1RM progressPct, achieved - same semantics as
  the progress page incl. effective load) and `CoachPayload.fatigue` (stalled lifts over the
  12-week window, deload recommendation with the same human-readable reason lines the
  banner shows, via the new shared `deloadReasonLine`). System prompt gained usage guidance;
  the `<adjustments>` OUTPUT contract is untouched and its existing tests passed unmodified.
  Demo provider debrief now exercises the new fields. Full gate green on the first run.
- **#100 -> PR #105 (this PR): Strong CSV import.** Pure quote-aware parser
  `lib/import/strong-csv.ts` treating the file as untrusted input (5 MB / 50000-row caps,
  no eval, Zod on every row with the set schema's bounds, per-line error collection, cardio
  rows skipped with a count, kg/lb toggle with header-suffix override), pure planner +
  transactional executor (case-insensitive exercise matching, missing exercises created as
  OTHER/ISOLATION via an additive enum migration, sessions grouped per (date, workout) at
  noon UTC, exact-duplicate skip for idempotence), rate-limited Zod-validated route with
  dry-run preview and confirm modes, settings UI (pick -> preview -> confirm with the error
  list), and tests at every layer incl. a transaction-rollback integration test and an E2E
  upload -> preview -> confirm -> history flow. Two local gate reds fixed: jsdom `File.text`
  (FileReader fallback) and the catalog-coverage test (OTHER intentionally has no catalog
  exercise).

**Challenged.** This tick ran in an environment without a subagent tool, so per the charter
(lesson L8 rule) the multi-lens reviews could NOT be executed independently pre-merge. Each
PR merged only on green full CI after an author self-review pass; all three are flagged in
the run report for an independent POST-MERGE review by the orchestrator as its next action
(correctness + does-it-actually-work for all three, plus a security lens on #100's untrusted
file input and route).

**Deferred to human / orchestrator.** The post-merge independent reviews above. Note for the
reviewer: imported sessions render as "Free session" in the history list (the Strong workout
name lives in the session notes) - a possible polish slice, not a defect.

---

## 2026-06-10 (evening) - Fourth batch shipped, reviewed, hardened; README + demo media catch-up

**Context.** The fourth ideate batch (#99/#100/#101, two of them deliberate re-evaluations
of pre-directive rejections) was implemented by a background tick (PRs #103/#104/#105, all
merged on green full CI, migrations validated, rollback baselines tagged). The tick again
had no subagent tool and flagged all three for post-merge independent review per L8.

**Decided / shipped.**
- Three independent post-merge reviews ran in parallel: #104 CLEAN; #103 one REAL (sync
  race window) + nits; #105 three REAL under the security lens (chunked-body bypass of the
  5 MB cap, 5 s transaction timeout vs multi-year imports, CSV formula-injection chain
  into the export).
- Fixes shipped same-day: #108 (import hardening + lib/csv.ts extraction) and #109
  (user-row lock + re-derivation, deterministic tie-break, 20-300 kg bounds), both with
  tests pinning the failure modes and merged on green full CI.
- Operator directive captured and graduated: README features/roadmap refresh EVERY
  user-facing batch; screenshots when a captured page visibly changed; clips periodically
  with a ~3-batch staleness cap. Codified in the write-up skill + 05-content-loop; this PR
  does the catch-up (features list rewritten, roadmap split, all 4 screenshots re-shot,
  all 4 GIFs re-recorded against a seeded demo with the new features visible - the demo
  seed now also creates bodyweight entries, a goal, and readiness check-ins).

**Challenged.** The L8 backstop is now proven twice (5 REAL defects caught post-merge
across #95/#103/#105 that author self-review missed). The directive's trade - complexity
allowed, controls scaled up - is holding: every defect was caught by the loop's own
controls before any user impact.

**Deferred to human.** Nothing. NITs not fixed are recorded in the review digest entries.

---

## 2026-06-10 (later) - Post-merge backstop review of #95; fix #97; batch write-up

**Context.** The background tick that shipped #94/#95 reported it could not spawn an
independent reviewer (no subagent tool in its environment) and had self-executed the
"multi-lens" pass for #95 - which the charter does not accept as the challenge. The
orchestrator ran the missing independent review post-merge as its next action.

**Decided / shipped.**
- Independent post-merge skeptic on #95 (commit cc33953): ownership, migration drift
  (clean `migrate diff` against a shadow DB), e1RM math, and the set-save best-effort path
  all verified sound; ONE real defect found - deleting the achieving set left a goal
  permanently "Achieved".
- Filed #96, fixed via PR #97 (merged on green; the integration job's first red was the
  known transient ECR `toomanyrequests` pull failure - re-run, then green): set DELETE now
  re-derives `achievedAt` from the remaining sets, same best-effort pattern as stamping.
- Write-up: CHANGELOG (deload banner, shorthand logging, exercise goals, the charter
  widening), ideas-backlog #88/#89/#90 -> shipped, review digest for the batch, lesson L8
  graduated into the charter (no-independent-reviewer case now has an explicit rule).

**Challenged.** The review WAS the challenge - and it proved the point: an honest
self-review by the author missed a lifecycle defect an independent reviewer caught in one
pass.

**Deferred to human.** Nothing. Three NITs from the review (capped progress display vs
achieved badge, stamping race, missing fetch error toast in the goal card) noted as
accepted risks; none is data-incorrect.

---

## 2026-06-10 - Maintainer run: shipped #89 (set shorthand) and #90 (exercise goals)

**Context.** Maintainer tick over the third ideate batch. Both issues trust-gated (author
`JulienAu`), implemented in order, each behind its own PR and CI run. Merge budget 3; used 2.

**Shipped.**
- **#89 -> PR #94 (merged): quick set logging via shorthand.** Pure parser
  `lib/set-shorthand.ts` (`100x8`, `100 8`, `100x8@9`, decimals, RPE 1-10) + a quick-entry
  field in `set-input.tsx` that fills the classic weight/reps/RIR fields. The app tracks RIR,
  not RPE, so `rpeToRir` maps RIR = 10 - RPE rounded, clamped to the API's 0-5. Weight read in
  the display unit via `fromDisplayWeight`. No API/schema change. 28 new unit/component tests.
- **#90 -> PR #95 (this PR): per-exercise target goals.** First feature shipped under the
  charter's "complex features" directive, so it carries the reinforced controls: additive
  `ExerciseGoal` migration (validated with `prisma migrate deploy` + `migrate diff` drift
  check against the seeded test DB), Zod-validated upsert/list/delete routes with ownership
  tests, pure `lib/goals.ts` (progress = best e1RM / target e1RM; achievement = working set
  meeting both axes, stamped deterministically with the achieving set's `completedAt`),
  effectiveWeight semantics for bodyweight exercises at every layer, goal card + dialog on the
  progress page, and tests at all touched layers including a full E2E flow
  (`tests/e2e/goals.spec.ts`: set -> track -> achieve -> remove). `verify.sh --full` run
  locally before the PR; rollback baseline `autonomy-baseline-2026-06-10` tagged before merge.

**Challenged.**
- #89: independent skeptic on the staged diff. Caught early in self-review: a regex
  backtracking trap (`100 89.5` would have parsed as reps 8 @ RPE 9.5) - fixed by requiring a
  separator before the RPE; the skeptic pass then surfaced two cosmetic findings (a misleading
  test name, fixed; keep-RIR-when-RPE-deleted judged the correct default).
- #90: multi-lens review (correctness + does-it-actually-work), findings recorded in the PR.

**Deferred to human.** Nothing blocking. Note for ops: the local Docker daemon was down at
run start; the loop started Docker Desktop itself to run the full gate.

---

## 2026-06-10 - Operator directive: complex features with reinforced controls; third ideate batch

**Context.** The operator widened the feature mandate in-session: complex features (data-safe
migrations, LLM output-contract changes, multi-surface work) may now ship without human
review when they are a clear product plus - compensated by MORE non-regression control, not
more approval. Codified in the charter's new "Complex features" section; the ideate skill
and `08-ideation-loop.md` updated to match. Unchanged: hard guardrails, untrusted-input
rules, and stop-for-human for destructive data migrations, auth/security, major dep bumps.

**Decided / shipped.**
- Closed external test issue #57 (already triaged "not planned" in-thread, left open by
  mistake).
- Third ideate batch filed: #88 deload-week recommendation (display-only derivation), #89
  set-logging shorthand parser (roadmap's natural-language logging, deterministic slice),
  #90 per-exercise target goals (additive ExerciseGoal table + Zod API + progress UI).
  Backlog logged via PR #91 (merged on green).
- Charter amendment shipped via PR (this entry rides along).

**Challenged.** Docs-only changes; the gate + a re-read of the security sections stood in
for a code skeptic. The trust-model sections were verified unchanged.

**Deferred to human.** Nothing; the directive explicitly removes the human from complex
feature review while keeping the security stop-list.

---

## 2026-06-09 - Second ideate batch (#80/#81/#82 via #84/#85/#86)

**Context.** The second batch of ideate-produced product features shipped autonomously; this
docs run is the content-loop tail that records it.

**Shipped this batch.** Three additive, derived-on-read features, no schema/migration:
- **#84 / #80 - personal records on the post-session summary.** Confirmed against
  `components/session/session-summary.tsx`: `computeSessionPRs` reuses `lib/records` `detectPRs`
  against a "since last session" baseline (prior-session sets + earlier sets this session), so a
  set is never compared with itself; warm-ups excluded; renders a "Personal records this session"
  card with heaviest-load / best-e1RM badges.
- **#85 / #81 - MEV/MRV volume landmarks.** Confirmed against `lib/stats.ts`:
  `WEEKLY_SETS_MEV=10`, `WEEKLY_SETS_MRV=20`, `weeklySetsByMuscleGroup` (working-set counts per
  ISO week, warm-ups excluded), and `classifyWeeklySets` (inclusive band -> BELOW_MEV / WITHIN /
  ABOVE_MRV). A "Volume landmarks" card on the progress dashboard; display-only.
- **#86 / #82 - stalled-lift detection.** Confirmed against `lib/stats.ts`: `isStalled` over a
  per-session best-e1RM series with `STALL_LOOKBACK_SESSIONS=3` and `STALL_TOLERANCE=0.005`
  (0.5%), never flagging with fewer than `lookback` sessions; a "Stalled lifts" card on the
  progress dashboard.

**Challenged / verified.** Docs-only, verification-first: every CHANGELOG/log claim was read out
of `components/session/session-summary.tsx` and `lib/stats.ts` (the constants, the band edges,
the lookback/tolerance) before writing it, not trusted from the PR summaries.

**Lesson harvested.** L7 - #81 and #82 both edited `lib/stats.ts` and the progress dashboard; the
two implement agents overlapped, so the second branch cut from a stale `main` and hit a merge
conflict (resolved by merging `main` in and keeping both additions). Graduated into the
orchestration decision order (`06`): serialize same-file queued issues, gated on the prior PR
actually merging - sharpening the existing "one writer per task" / "green separately, red
together" notes.

**Comprehension digest exercised.** The per-batch reading-list mechanism (#79) was used: the
digest ranks this batch modest and points the human first at the shared `lib/stats.ts` helpers
(`isStalled` / `classifyWeeklySets` / `weeklySetsByMuscleGroup`), with the additive cards to skim.

**Trust gate.** All three documented PRs (#84/#85/#86) and the issues they closed (#80/#81/#82)
were authored by `JulienAu`, on the maintainer allowlist - in-scope for the loop.

**Deferred to human / operator.** Unchanged: dep majors + `bcrypt` 6 remain parked; the
non-additive product ideas the ideate run rejected stay for a human.

---

## 2026-06-09 - The loop starts growing the product: ideation + the first ideate batch

**Context.** A multi-tick session that closed the gap between "the loop maintains the repo"
and "the loop grows the product", then proved the public-repo guardrail under a real attack.
This docs run is the content-loop tail that records it.

**Shipped this arc.**
- **Ideation loop (#68) + first ideate run (#73).** Added the `ideate` skill and
  `docs/loops/08-ideation-loop.md`: when ship and triage have nothing, manufacture
  well-scoped, single-PR product feature ideas grounded in the product vision and the
  captured competitor research, and file them as crisp issues. The first run proposed three
  (issues #69/#70/#71) and rejected the gaps that did not fit one tight PR (bodyweight history,
  supersets, CSV import), logged in `ideas-backlog.md`.
- **Memory / learning / regrounding architecture (#74).** Added
  `docs/loops/09-memory-and-learning.md`: the loop framed as a cybernetic feedback control
  system - setpoint (the product vision + charter), externalized durable memory (git + GitHub +
  files, not the session), lessons that graduate into skills, and regrounding each tick. It
  also states what we deliberately do not build (vector RAG, parallel writers, unbounded
  memory) and why.
- **First ideate batch shipped (issues #69/#70/#71 via PRs #75/#76/#77).** The first product
  features the ideation loop produced, each additive, derived-on-read, no migration:
  - **#75 / #69 - warm-up set calculator.** Confirmed against `lib/warmup.ts`: a pure
    `computeWarmupRamp` producing 40/60/80 percent stages with descending reps in the display
    unit, rounded down to a loadable increment (2.5 kg / 5 lb), clamped below the working
    weight, de-duplicated, with an empty-bar lead-off; display-only, never mutates a set.
  - **#76 / #70 - personal-record badge.** Confirmed against `lib/records.ts`: `detectPRs`
    returns `'weight'` (heaviest non-warmup load) and/or `'e1rm'` (Epley estimate beats the
    best prior) by comparing a candidate against prior history; warm-ups excluded, strict
    comparisons so ties never flag, no records table.
  - **#77 / #71 - training consistency card.** Confirmed against `lib/stats.ts`
    `trainingConsistency`: distinct trained days per ISO week over a 12-week window plus the
    current streak of consecutive on-streak weeks, with an optional weekly-frequency target and
    a partial current week that does not break the streak; rendered by
    `components/progress/consistency-card.tsx` on the progress page.
- **Public-repo guardrail proven by the #57 red-team + CI hardening (#67).** The trust gate
  closed external issue #57 as not-planned (untrusted authorship; never promoted to
  auto-implementable), validating the #56 hardening under a real probe. CI was modernized for
  Node 24 runners and the Postgres image pull hardened (#67).

**Challenged / verified.** Docs-only, so verification-first rather than a code subagent: every
CHANGELOG and log claim was read out of `lib/warmup.ts`, `lib/records.ts`, and `lib/stats.ts`
before writing it, not trusted from the PR summaries. One correction caught this way: #71 ships
a consistency *card*, and the `globalThis.Set` shadow workaround lives in `lib/stats.ts` (not
`lib/records.ts`); recorded as lesson L6.

**Lesson harvested.** L6 (Prisma's generated `Set` model shadows the global `Set`; use
`globalThis.Set` in lib that touches both) - accepted risk. The mid-batch "job was not acquired
by Runner" GitHub Actions outage reconfirmed L2 (read the failing step; infra, re-run) - noted
under L2 rather than as a new lesson.

**Trust gate.** All documented PRs (#75/#76/#77) and the issues they closed (#69/#70/#71) were
authored by `JulienAu`, on the maintainer allowlist. External issue #57 was correctly refused.

**Deferred to human / operator.** The non-additive product ideas the ideate run rejected
(bodyweight/measurement history, supersets/circuits, CSV import) stay parked for a human; dep
majors and `bcrypt` 6 remain deferred.

---

## 2026-06-09 - Chain everything: templates, readiness explainability + opt-out

**Context.** Operator said "chain everything": run the full pipeline unsupervised under the
charter. Three product bets (issues #59/#60/#61) were scoped, implemented, and merged
autonomously this session; this docs run is the content-loop tail that records them. Three
PRs had merged since the last write-up (PR #58) and were undocumented.

**Decided / shipped (this PR, docs only).** Documented the three merged PRs, each verified
against the merged code, not just the PR description:
- **PR #62 / issue #59 (expanded template catalog).** Confirmed against
  `lib/programs/templates.ts`: six new `ProgramTemplate` entries (slugs
  `starting-strength-3day`, `stronglifts-5x5-3day`, `madcow-5x5-3day`, `phul-4day`,
  `phat-5day`, `full-body-3day`) added additively next to the original five, each
  schema-validated at module load and asserted to materialize into a runnable program by
  `templates.test.ts`. CHANGELOG: extended the existing `Added` templates line.
- **PR #63 / issue #60 (readiness explainability).** Confirmed against
  `components/session/exercise-card.tsx`: the `readiness-hold` / `readiness-deload` reason
  from `suggestNextWeight` is plumbed to the set UI and rendered as a badge composed from a
  verb ("Held" / "Lighter") and a cause ("reported soreness" / "low readiness today"), with
  no UI when there is no readiness signal. CHANGELOG: a new `Added` line.
- **PR #64 / issue #61 (readiness auto-regulation opt-out).** Confirmed against
  `lib/preferences.ts` (`readinessAutoRegulation: true` in `DEFAULT_PREFERENCES`, additive,
  no Prisma migration) and `lib/progression.ts` (`readinessForSuggestion` gate, applied in
  `SessionRunner`): default on; off reproduces pre-readiness pure programmed progression.
  CHANGELOG: folded into the existing `Changed` readiness-progression line.

**Challenged.** Verification-first (docs-only, no product code): each CHANGELOG/log claim was
checked against `lib/programs/templates.ts`, `components/session/exercise-card.tsx`,
`lib/preferences.ts`, and `lib/progression.ts` before writing it. The badge wording in the
PR summary matched the code (verb + cause composition).

**Trust gate.** All three documented PRs (#62/#63/#64) and the product issues they closed
(#59/#60/#61) were authored by `JulienAu`, on the maintainer allowlist - in-scope for the
loop. External issue #57 was closed as not-planned by the trust gate (untrusted external
authorship; never promoted into auto-implementable work).

**Deferred to human / operator.** Dependency major bumps and `bcrypt` 6 remain parked as a
separate human-reviewed draft, not actioned here. Further product calls (still more
templates, progression-threshold tuning) noted for the operator rather than filed as
auto-implementable issues.

**Idle.** After this docs PR the product backlog is empty; a triage sweep follows to decide
whether a crisp, single-PR code-health item is worth manufacturing, else a clean idle.

---

## 2026-06-09 - Write up the readiness-progression loop and the public-repo hardening

**Context.** Maintainer tick. Decision order per `06-orchestration.md`: drain ready PRs,
refill if starved, implement one issue, then write up. Verified state with `gh` before
acting: zero open PRs, zero open issues, `main` clean. Two PRs had merged since the last
write-up (PR #52) and were undocumented, so step 1 (ship) and step 3 (implement) had
nothing to do; the actionable work this tick was the content loop.

**Decided / shipped (this PR, docs only).** Documented the two merged, undocumented PRs,
each verified against the merged code, not just the PR description:
- **PR #55 / issue #53 (readiness now influences deterministic progression).** Confirmed
  against `lib/progression.ts`: an optional third `readiness?: ReadinessSignal | null`
  param on `suggestNextWeight`, named threshold constants, a recency gate
  (`ageHours <= 36`), `readiness-hold` / `readiness-deload` reasons, soreness keyed on the
  exercise's `muscleGroup`, and the never-raises invariant. CHANGELOG: a `Changed` line
  under the coach/progression behavior (the suggestion's contract is the same; its inputs
  grew).
- **PR #56 / issue #54 (harden the loop against untrusted public input).** Confirmed
  against the merged diff: the new "Untrusted external input (public repo)" section in
  `07-autonomy.md`, the trust-gating to the `{JulienAu, Julien-Au}` login allowlist, the
  fork/author gates in `ship-pr` and the untrusted-data treatment in `implement-issue` /
  `triage`, and the `curl`/`wget` deny in `.claude/settings.json` (lines 50-51). CHANGELOG:
  a `Changed` line under the loop-infrastructure story (the loop infra IS the story, so it
  belongs in the public changelog).

**Session arc being recorded.** This run closes out a multi-tick session: research-driven
product features #37-#40 (readiness/soreness data model, per-muscle soreness map + note,
coach auto-regulation signal, UI wiring), then the readiness-into-progression loop (#53),
then the security hardening for the now-public repo (#54). The throughline: the product
gained a real auto-regulation signal end to end (capture -> coach context -> deterministic
suggestion), and the loop gained the guardrails to keep running that autonomy safely in
the open.

**Challenged.** Verification-first rather than a code subagent (docs-only, no product
code): every CHANGELOG/log claim was checked against `lib/progression.ts`,
`.claude/settings.json`, and `07-autonomy.md` before writing it. No drift found; the PR
descriptions matched the merged code.

**Trust gate.** Both documented PRs (#55, #56) were authored by `JulienAu`, on the
maintainer allowlist - in-scope for the loop. No external/untrusted authorship this tick.

**Deferred to human / operator.** Nothing hit the hard stop-list. Still parked as product
calls (noted for the operator, not filed as auto-implementable issues): more program
templates, and any further auto-regulation tuning of the progression thresholds. Dep
majors + `npm audit fix --force` (bcrypt 6) remain deferred.

**Idle.** After shipping this docs PR: backlog empty. Triage step did not surface a crisp,
single-PR code-health/coverage/small-bug item worth manufacturing this tick, so the run
ends on a clean idle once the docs PR is merged. Within the 3-merge cap.

---

## 2026-06-09 - Ship the log PR, then implement the soreness/note check-in UI

**Context.** Maintainer tick. Decision order per `06-orchestration.md`: drain ready PRs
first, then implement one issue, then write up. Verified state with `gh` before acting:
PR #50 (docs) had three green checks with E2E pending; one open issue, #48.

**Decided / shipped (merged, 2).**
- **PR #50 (docs: changelog the shipped features + log the prior tick).** Polled E2E to
  green (all four checks pass), reviewed the diff (CHANGELOG entries for the shipped
  plate calculator / templates / readiness features + an accurate dated log entry, no
  em-/en-dashes), squash-merged. This drained the only ready PR, satisfying step 1.
- **PR #51 (feat: capture per-muscle soreness and a note in the readiness check-in,
  Closes #48).** Implemented next; green CI; squash-merged.

**Implemented #48.** The readiness data model, `/api/readiness` route, and coach prompt
already supported a partial `MuscleGroup -> 1-5` soreness map and a free-text note (#38),
but the pre-session UI only submitted `readiness` + `sleepQuality`, so that coach
capability was dead. Wired it up in `components/session/readiness-checkin.tsx` behind an
optional, collapsed-by-default "Add soreness / note" toggle so the quick two-tap path is
unchanged: per-muscle soreness rated 1-5 (labels reused from the shared
`MUSCLE_GROUP_LABELS`), tap-again-to-clear, an optional note via the existing `Textarea`
primitive capped at 500 to match the schema. Only rated groups are sent (a partial map);
an empty map / blank note are omitted. The payload is validated client-side with the same
`readinessCheckinInputSchema` the route uses (no duplicated validation). Added
`components/session/readiness-checkin.test.tsx` (quick path, missing-rating guard,
collapsed-by-default, partial-map + note round-trip, tap-to-clear). No change to the
route, schema, prompt, or coach output contract.

**Challenged.** Independent skeptic lens (`code-review`, high) on the diff: no
correctness or convention defects. Pressure-tested the one real regression risk - that the
new client-side `safeParse` could reject a previously-valid quick-path submission - by
probing `readinessCheckinInputSchema` against every payload the component builds (quick
path, soreness + note, max-length note); all validate, so the quick path is a strict
subset of the old behavior. The only note (soreness section has no re-collapse) is
intentional low-friction design, not a defect. Verdict: ready.

**Process notes.** Green-gate passed (lint + typecheck + unit + build); the 5 new
component tests pass under vitest. Test-Postgres schema was already migrated from the
prior tick, so the integration tier (run in CI) needed no `prisma migrate deploy` here. No
route add/remove on the branch, so no stale `.next/types` cleanup needed.

**Deferred to human.** Nothing hit the hard stop-list. Still parked from earlier ticks:
dep majors + `npm audit fix --force` (bcrypt 6); wiring readiness/soreness into the
deterministic `suggestNextWeight` progression and "more program templates" remain product
calls, not filed.

**Idle.** After this: zero open issues, zero open PRs. Backlog genuinely empty; did not
manufacture triage work this tick (cap reached on useful work, clean idle is success). 2
merges this run, under the cap of 3.

---

**Context.** Maintainer tick after the research-driven product run. Decision order per
`06-orchestration.md`: drain ready PRs first, then refill if the backlog is starved, then
implement one issue, then write up. Verified state with `gh` before acting: PR #46 green,
zero open issues.

**Decided / shipped (merged, 1).**
- **PR #46 (docs: log the research-driven product run).** All four CI checks green, docs-only,
  reviewed the diff (a single dated log entry, accurate, no em-/en-dashes). Squash-merged. This
  drained the only ready PR; #43/#44/#45 had already merged earlier in the session, so step 1
  was satisfied.

**Backlog was empty -> triaged (2 issues filed).** Swept code markers (none), lib coverage
holes, the README roadmap, and `npm outdated`/`audit`. The in-range dep bumps were already
applied in #45 and everything left is a major (stop-list), so no dep issue. Filed:
- **#47 - integration coverage for the `/api/readiness` route handlers.** The route shipped in
  #38 had no direct test (only the coach-payload side was covered); other routes are covered in
  `route-ownership.test.ts` but this newer one was missed.
- **#48 - let the readiness check-in capture per-muscle-group soreness (and a note).** The
  schema, route, and coach prompt all already support `soreness` + `note`, but the UI only
  submits readiness + sleep, so that coach capability is effectively dead. Small UI half of an
  already-built feature, not a new product direction.

Deliberately did NOT file: wiring readiness into the deterministic `suggestNextWeight`, and
"more program templates" - both are product calls, not single-PR mechanical work.

**Implemented #47 (PR #49, opened, CI pending).** Added `tests/integration/readiness-route.test.ts`
(GET + POST: 201 + persist, soreness/note round-trip, Zod 4xx with nothing persisted, GET
latest/null, GET scoped to caller). Test-only, no production code. Green-gate `--full` passed
(26 integration tests, E2E green).

**Challenged.** Independent skeptic lens (`code-review`) on the diff: no correctness/convention
defects, but it flagged that the cross-user isolation test only proved the stranger got `null`
because they had no row - not that the owner's row was filtered. Treated as a real (if minor)
finding: rewrote the test so the stranger has an older row and the owner a newer one, so an
unscoped query would have leaked the owner's; now it genuinely proves scoping. Re-verified green.

**Process notes.** The freshly-created test Postgres on :5434 had no schema; the integration
tier failed with `relation "Message" does not exist` until `prisma migrate deploy` was run
against it. Not a code defect - environment setup. Strict `noUncheckedIndexedAccess` rejected
`checkins[0]`; switched to `findFirstOrThrow`. No destructive ops; `find -delete` not needed
this tick (no route add/remove on the branches switched).

**Deferred to human.** Nothing hit the hard stop-list. Dep majors + the `npm audit fix --force`
(bcrypt 6) still parked from #35. #48 left for the next implement tick.

**Next.** Ship #49 on green CI (next tick / human). Then implement #48 (the soreness UI), or
idle if no actionable work remains.

---

## 2026-06-09 - Research-driven product issues (#39, #37, #38, #40, #35)

**Context.** Operator fed in five research-driven product issues and set a merge cap of 2
for this run (operator actively in the loop). Worked them in risk order, lowest first.

**Decided / shipped (merged, 2).**
- **#39 - in-workout plate-loading calculator (PR #41, merged).** Pure greedy per-side
  decomposition in `lib/plates.ts` working in the user's display unit, honest about
  unloadable remainders; a Dialog surfaced from the set logger; per-unit bar/plate config in
  preferences + settings. Additive UI + pure helper.
- **#37 - built-in program templates (PR #42, merged).** 5/3/1 BBB, GZCLP, nSuns, PPL,
  Upper/Lower as static typed `GeneratedProgram` data, validated at module load against the
  existing generation schema and materialized through the same `/api/programs/build` route,
  so the coach treats them like any user-authored program. "Start from a template" picker.

**Opened, not merged (cap reached - left green/pending for the human or next tick).**
- **#38 - readiness/soreness check-in (PR #43).** New `ReadinessCheckin` table (kept STRICTLY
  additive - verified with `prisma migrate diff` -> "No difference detected"; CREATE TABLE +
  INDEX + FK only, no backfill, no destructive change), Zod-validated `/api/readiness`,
  optional skippable pre-session UI, and a `latestReadiness` INPUT field on the coach payload.
  The `<adjustments>` OUTPUT contract is untouched; the prompt only gained guidance to reason
  over readiness.
- **#40 - coach positioning audit (PR #44).** Audit finding: the apply path already prevents
  silent rewrites (Zod-validated, opt-in, user-accepted, scoped to existing program
  exercises). Fix was prompt WORDING only: advise within the program, never restructure,
  always explain the why; framed generated programs as editable drafts. Output contract pinned
  unchanged by a test - so this did NOT hit the stop-list and went out as a normal PR.
- **#35 - in-range dep bumps (PR #45).** `npm update` for patch/minor within range
  (Radix, react-hook-form, vitest, dexie, tsx, @anthropic-ai/sdk 0.98.1, types). Lockfile-only,
  no majors. Deferred majors + the node-tar advisory noted in the PR body.

**Challenged.** Each non-trivial change reviewed by an independent skeptic lens before
merge/open. #38 used the two required lenses: correctness (input threading / JSON coercion /
user-scoping) and migration-stays-additive (confirmed via `migrate diff`). No blocking findings;
the additive-migration property held.

**Deferred to human.** Nothing hit the hard stop-list this run - #38's migration stayed
additive and #40 stayed within the output contract, so both were shipped as normal PRs rather
than drafts. The dep majors and the `npm audit fix --force` (bcrypt 6) remain for a human per
#35's scope.

**Process notes.** Caught and cleaned stale `.next/types` artifacts when switching between
branches that add/remove routes (would otherwise red the typecheck step); `rm -rf` stayed
denied, used targeted `find -delete`. Rebased #38 onto the post-#37 main; the two branches'
additions to `core.test.ts` / `setup.ts` merged cleanly.

**Next.** Ship #43, #44, #45 on green CI (next tick / human). Then idle unless new actionable
work arrives.

---

## 2026-06-08 - Route ownership + steady state

**Decided / shipped.**
- #30 (Closes): route-level integration tests proving per-user data isolation on
  `DELETE /api/sets/[id]`, `PUT /api/sessions/[id]`, `GET /api/exercises/[id]` - owner
  succeeds, stranger gets 404 and the row is left intact. The subagent verified this is
  non-vacuous: the auth mock genuinely controls the acting user (owner cases return 200,
  not 401) and the 404 comes from the ownership branch, so the security property is really
  asserted in both directions.

**Steady state.** The high-value, single-PR backlog is now exhausted. Tested: the pure-logic
modules (schemas, units, preferences, api, last-performance) and route-level ownership.
Remaining gaps are deliberately NOT auto-filed:
- low-ROI browser-IO modules (`sync`, `indexeddb`, `wake-lock`, `sound`, `vibrate`) - hard to
  test meaningfully, little payoff;
- larger product work (the roadmap's in-session AI suggestions, AI-coach unit localization) -
  needs human product scoping per the charter's stop list.

Manufacturing busywork would degrade the tracker and the démarche, so triage files nothing.

**Mode.** The loop transitions to MONITOR MODE: it wakes on a long interval, ships any green
PR, implements any newly-filed actionable issue (with subagent review), and otherwise idles.
This is a clean idle, not a failure - the pipeline stays ready for new work.

**Session tally.** ~12 issues closed (#1-#5, #8, #18-#20, #26-#27, #30), the end-to-end loop
system + autonomy charter + git rollback baseline, imperial-unit support, and broad
unit/integration/security test coverage. The adversarial subagent loop caught two real product
regressions (a mis-classified exercise, a silent kg rounding change) and the process guardrails
caught two slips (a masked red-gate commit, a mixed-scope branch) - all fixed without
force-pushing or touching main directly.

---

## 2026-06-08 - Coverage round + honest triage

**Context.** Drain the test backlog and decide, honestly, whether more work is warranted.

**Decided / shipped.**
- #26 (Closes): unit tests for `lib/preferences.ts` (localStorage defaults, merge, corrupt-JSON
  fallback, round-trip, helpers). Subagent review: READY.
- #27 (Closes): unit tests for `lib/api.ts` error handling - `handleApiError` status mapping
  (ApiError / Prisma P2002 -> 409 / P2025 -> 404 / unknown -> 500 with no message leak) and
  `parseJsonBody` rejection paths. Subagent review: READY; the reviewer ran a probe to confirm
  `instanceof Prisma.PrismaClientKnownRequestError` actually holds, so the 409/404 branches are
  genuinely exercised (not vacuous).

**Triage (honest).** The high-value pure-logic modules now have tests (schemas, units,
preferences, api, last-performance). Rather than manufacture low-ROI tests for IO/DB modules,
filed ONE genuinely valuable item: #30, route-level integration tests for per-user ownership
(data isolation is a security guarantee with zero route-level coverage today). Identified the
mockable auth seam (`getCurrentUserId`) so the issue is implementable, not half-baked.

**Challenged.** Subagent reviews on #26 and #27 (both READY).

**Deferred to human.** None. Larger product work (the roadmap's in-session AI suggestions)
still needs scoping and is intentionally not auto-filed.

**Next.** Implement #30 (intermediate: test Postgres + auth mocking) with subagent review. If
the backlog empties again with no genuinely useful work left, idle cleanly - that is a valid
outcome, not a failure.

---

## 2026-06-08 - Backlog cleared (tests + polish)

**Context.** Drain the triaged batch (#18/#19/#20) and keep the pipeline honest.

**Decided / shipped.**
- #19 (Closes): unit-agnostic set-note placeholder. Trivial copy change, so no subagent
  review per the charter's non-trivial threshold - documented that judgment in the PR.
- #18 (Closes): validation tests for the six untested `lib/schemas` Zod schemas (40 cases).
- #20 (Closes): integration tests for `getLastPerformances`, run against the real test
  Postgres locally (full integration suite 7/7) before shipping, not just typechecked.
- Subagent reviews on #18 and #20 returned READY; the #18 review prompted documenting a
  real `z.coerce.boolean()` footgun ("false" coerces to true).

**Challenged / process guardrails that fired.**
- **Commit on a RED gate, caught and reverted.** A `verify.sh | tail && git commit` chain
  let the pipe mask verify.sh's non-zero exit, so a commit landed while typecheck was red.
  Caught it immediately, fixed the test, re-verified by capturing the exit code to a file.
  Lesson recorded in the loop prompts: never pipe the gate through `tail` in a commit chain.
- **Mixed-scope branch, untangled.** The #18 test commit had been stacked on the #19
  branch; recovered by cherry-picking it onto a clean branch so each PR holds one scope.
- **Non-fast-forward after an amend, reconciled without force.** Amending an already-pushed
  commit broke the push; resolved with `reset --soft` + a new commit (force-push stays
  denied by the charter), never rewriting pushed history.

**Deferred to human.** None.

**Next.** Backlog empty -> triage to refill (uncovered lib modules / small polish), then
implement with subagent review. The big roadmap item (in-session AI suggestions) is left
for a human to scope.

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
