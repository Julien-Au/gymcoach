# Autonomy log

Append-only journal of autonomous runs. Newest first. Each entry: what was decided and
why, what shipped, what was challenged by subagents, what was deferred to a human. Governed
by the charter in [`07-autonomy.md`](07-autonomy.md).

---

## 2026-06-16 - Three display-only slices: exercise cue in the logger, weekly frequency, e1RM loading table (#224/#225/#226)

**Context.** Maintainer tick, three additive DISPLAY-ONLY product slices, serialized by ascending
size (each PR merged before the next branch was cut). All three authored by JulienAu, trust-gated
(login allowlist + collaborator check HTTP 204). Inherited model this cycle (Fable unavailable). None
touched schema, API, or the LLM contract; each shipped colocated tests and passed `bash scripts/verify.sh`.

**Decided / shipped.**
- **#224 (PR #228, merged on green).** Surface `Exercise.notes` as an always-visible muted "cue" line
  under the exercise header in the session set logger (`components/session/exercise-card.tsx`), so the
  form reminder is there exactly while logging. Read the source first: the full exercise row (with
  `notes`) was ALREADY threaded through the session-runner serialized shape via
  `ProgramExercise & { exercise: Exercise }`, so NO serialization change was needed (the issue allowed
  for it but it was unnecessary). The card already rendered `exo.notes` behind a collapsed "Notes /
  mind-muscle cue" toggle; this adds the always-visible line on top, leaving the per-set quick-note
  field and the collapsible block unchanged. Component tests cover with-notes / without-notes / cardio.
- **#225 (PR #229, merged on green).** New pure `weeklyFrequencyByMuscleGroup` in `lib/stats.ts`:
  distinct training days (UTC calendar days with >= 1 working set hitting the group) per muscle group
  per ISO week. Deliberately mirrors `weeklySetsByMuscleGroup`'s ISO-week bucketing and warmup + cardio
  exclusion so frequency reads consistently with the volume card. Surfaced as "Nx/week" on each Volume
  landmarks row, for the EXACT week the card already displays (page picks the frequency point matching
  `latestCompletedWeek.weekKey`), so volume and frequency describe the same week. Reuses the
  `weeklySetsRaw` query already on the page. Unit tests: two sets same day = 1, two days = 2, warmup +
  cardio excluded, empty week = 0.
- **#226 (PR #N, this entry rides here, merged on green).** New pure `computeLoadingTable` in
  `lib/loading-table.ts`: default percentages (95..60%) of an exercise's best e1RM, each rounded to the
  NEAREST loadable increment (2.5 kg / 5 lb) in the display unit (round-to-nearest, distinct from the
  warm-up ramp's round-DOWN, since a planned working load reads best on the closest plate jump). The
  e1RM is stored in kg and is bodyweight-adjusted for bodyweight movements (consistent with the rest of
  the page); the dashboard converts to the display unit before deriving so rounding lands on real plate
  jumps. Rendered as a collapsible native `<details>` "Training loads" table on the selected exercise's
  progress view, hidden entirely when the exercise has no e1RM (empty list). Unit tests pin the
  percentage->load math in kg and lb, the round-to-nearest behavior, the no-e1RM empty case, and a
  custom percentage set.

**Challenged.** No review subagent was spawned this run (nested run). Per the charter's backstop these
are flagged for an OPTIONAL light post-merge correctness review by the orchestrator; all three are
pure additive display-only derivations with no production-contract surface, so the risk is low. Self-checked
that each new test is non-vacuous (e.g. the frequency test distinguishes distinct-day counting from a
raw set count; the loading-table test distinguishes round-to-nearest from round-down).

**Production bugs surfaced.** None. No unexpected schema/contract need arose; scope held to display-only.

**Deferred.** Nothing.

---

## 2026-06-15 - Test-only hardening: de-flake readiness check-in + pin last-performance derivation (#219/#220)

**Context.** Maintainer tick, two test-only issues, serialized (PR #222 MERGED before the #220 branch
was cut). Both authored by JulienAu, trust-gated (login allowlist + collaborator check HTTP 204).
Inherited model this cycle (Fable unavailable). Pure test changes with no production diff, so the
post-merge independent-review backstop does NOT apply; the discipline that did apply was "never weaken
a test to make it pass" - both PRs assert the REAL contract, read from source first.

**Decided / shipped.**
- **#219 (PR #222, merged on green).** The readiness check-in unit test "submits a partial soreness map
  and a note" intermittently timed out (default 5s) when the full unit suite runs in parallel under CPU
  contention (WSL2); green in isolation and in CI where tiers run separately. Fix is test-only:
  `userEvent.setup({ delay: null })` in the shared `openForm` helper (drops user-event's artificial
  per-keystroke/per-click timer, the actual stall) plus a 15s timeout on the single heaviest case as
  belt-and-suspenders. The component is untouched and every assertion is byte-for-byte unchanged.
  Verified by running the file x3 in isolation and a full `verify.sh` - no timeout.
- **#220 (PR #N, this entry rides here, merged on green).** Added colocated `lib/last-performance.test.ts`
  pinning the pure derivation that `tests/integration/last-performance.test.ts` only covered through a
  real DB. `getLastPerformances` reads `@/lib/db` directly (no pure-function seam), so the unit test
  mocks `@/lib/db` with a small in-memory fake that HONORS the `where`/`orderBy` the function builds -
  warmup exclusion, exclude-session, and most-recent selection are exercised through the real query
  construction, not re-implemented in the assertions. Covers: strength max-load + reps-at-max-load +
  raw set list; warmup exclusion; exclude-session vs latest; cardio totals (duration/distance SUMMED,
  HR AVERAGED+rounded over ONLY the rows that recorded one - the (150+170)/2=160 case rules out a sum
  or an over-all-rows average), null-HR and missing-distance edge cases, multi-exercise resolution, and
  no-history (absent from map, no crash). Bodyweight: documented + asserted that the derivation returns
  the raw stored `Set.weight` (effective-load is a consumer concern in `lib/stats`, not applied here).

**Challenged.** No review subagent was spawned, but these are pure test additions with no production
surface, so the charter's post-merge backstop is not triggered. Self-checked that the assertions are
non-vacuous (the HR-average pin would fail against a sum or a /N-over-all-rows implementation).

**Production bugs surfaced.** None. The derivation behaves exactly as the new tests assert.

**Deferred.** Nothing.

---

## 2026-06-15 - Coach records, custom volume targets, AI-parsed set logging (#212/#211/#210)

**Context.** Maintainer tick, three feature issues, strictly serialized by ascending size (each PR
MERGED before the next branch was cut). All three authored by JulienAu, trust-gated (login allowlist
+ collaborator check HTTP 204). Inherited model this cycle (Fable unavailable) - fine. Two of the
three are complex (an LLM-payload change, a schema+migration+API+UI change, and an untrusted-LLM-
output feature), so the reinforced complex-feature controls applied: full local gate + tests at every
touched layer + fresh rollback baseline before the migration. **Could not spawn review subagents this
run**, so per the charter's "no independent reviewer" backstop these PRs merged on a green FULL gate
and are FLAGGED here for post-merge independent review.

**Decided / shipped.**
- **#212 (PR #214, merged on green).** Feed the AI coach the all-time records. New
  `CoachPayload.records` via the SAME shared `lib/records.ts` `exerciseRecords` derivation the
  progress board uses (full history, effective load, cardio excluded at the query, warm-ups excluded);
  capped to the most-recently-trained exercises (`COACH_RECORDS_CAP = 20`), per-record dates dropped
  to stay compact. Input-side only: a short prompt addition tells the coach to reference and celebrate
  a PR and NEVER invent a record, and records never go in `<adjustments>`. The `<adjustments>` contract
  tests pass UNMODIFIED. Demo provider's canned debrief now references a record. Integration tests pin
  the bests (heaviest-set vs best-e1RM on different sets), cardio exclusion, cross-user isolation, and
  empty-for-a-fresh-user.
- **#211 (PR #215, merged on green).** User-settable weekly volume targets (personal MEV/MRV per
  muscle). Additive `VolumeTarget` table (unique per user+muscle, cascade delete) - absent rows fall
  back to the 10/20 defaults, so existing users are unaffected. Zod-bounded (`mev >= 1`, `mrv > mev`,
  max 40), ownership-scoped GET/POST/DELETE `/api/volume-targets` (every handler scoped to the auth'd
  user by construction). `classifyWeeklySets` stayed PURE - new `resolveVolumeBand` merges the user's
  targets with the defaults (and ignores an internally inconsistent stored band) and the page passes
  the resolved band in. Card shows each group's active band and custom-vs-default; inline
  `VolumeTargetEditor` dialog edits mev/mrv with reset-to-default.
  - *Migration discipline:* additive migration validated on the test DB the way CI does -
    `prisma migrate reset` (all migrations from scratch) + `prisma migrate diff` -> "No difference
    detected". Fresh rollback baseline `autonomy-baseline-2026-06-15` tagged + pushed on main BEFORE
    the first migration merge. docker-smoke (which runs `migrate deploy` on a fresh DB) stayed green.
- **#210 (PR #<this>, merged on green) - THE LAST ROADMAP ITEM.** Free-text (AI-parsed) set logging.
  Opt-in "Parse with AI" button next to a free-text field in the set logger fills the form for the
  user to confirm - it NEVER auto-logs, and the deterministic shorthand path is untouched (normal
  logging never waits on the network). New `lib/prompts/set-parse-prompt.ts` (stable, cacheable) +
  `lib/schemas/set-parse.ts`: a NEW, SEPARATE parse contract (discriminated union strength|cardio)
  pinned by contract tests; the `<adjustments>` contract was NOT touched or reused. The model output
  is UNTRUSTED: `parseSetDescription` extracts JSON and Zod-validates against the set bounds, failing
  CLOSED (`{ ok: false }`) on no-JSON / invalid-JSON / out-of-range / refusal / wrong-kind, so the UI
  fills nothing and shows a "could not parse, try the shorthand" hint - never throws, never logs
  garbage. `aiParseSet` also swallows provider errors to null. Route `/api/sets/parse` is ownership-
  checked + rate-limited and returns `{ parsed: null }` (a 200, not an error) on a junk parse. Demo
  provider returns a canned strength/cardio parse (and the refusal sentinel for an UNPARSEABLE marker)
  so the no-key flow works. README roadmap box checked. Coverage: schema contract tests (valid shapes
  accepted, every junk/out-of-range path rejected, wrong-kind rejected), demo-provider tests, route
  integration (owner parse, cardio parse, `parsed: null` on refusal, NO set logged as a side effect,
  404 on another user's exercise, 400 empty, 401 unauth), component tests (fill-then-confirm, unit
  conversion, null-parse fills nothing, cardio-on-strength ignored), and an E2E (type free text ->
  Parse with AI -> field fills -> Log).

**Challenged.** Subagent review tool was unavailable this run, so per the charter the author's own
pass does NOT satisfy the challenge protocol. These merged on a green FULL gate (`scripts/verify.sh`
tiers run locally: lint/type/unit/build + integration on :5434 + E2E; full CI green incl. integration,
docker-smoke, and E2E). **FLAGGED for post-merge independent review:** multi-lens for #214 and #215;
multi-lens INCLUDING untrusted-model-output handling for #210 (the parse fail-closed paths, the
ownership/rate-limit on the route, and that no set is ever logged from a parse).

**Deferred.** Nothing blocked. Roadmap's last unchecked item (free-text AI set logging) is now done.

---

## 2026-06-14 - Direct test coverage: CSV reader + profile schema (#198/#199)

**Context.** Maintainer tick, two test-only coverage issues, strictly serialized (each PR MERGED
before the next branch was cut). Both authored by JulienAu, trust-gated (login allowlist +
collaborator check HTTP 204). Inherited model this cycle (Fable unavailable) - fine. Pure test
additions, no production code touched, so a post-merge independent review was not required; the
discipline instead was "read the source first, assert the REAL contract, never weaken a test, and
STOP + file if a test surfaces a genuine bug". No bug surfaced - both modules behaved exactly as
documented.

**Decided / shipped.**
- **#198 (PR #200, merged on green).** New `lib/import/csv.test.ts`: direct, adversarial coverage
  for the shared quote-aware CSV reader (the untrusted-upload parsing core, previously exercised
  only through the Strong/Hevy parser tests). 29 tests over `readCsvRecords` (quoted commas, quoted
  newlines spanning lines, doubled-quote `""` escapes, trailing/empty fields, CRLF vs LF vs lone-CR,
  blank trailing + mid-file lines, final record with no newline, 1-based `line` numbers), `asNumber`
  (ints/decimals/whitespace/empty->0/garbage->NaN, exponent passes, and the `Number.isFinite` guard
  so Infinity/NaN never leak a non-finite value), and `headerKey` normalization.
  - *Contract clarified:* the caps `IMPORT_CSV_MAX_BYTES`/`IMPORT_CSV_MAX_ROWS` are exported
    constants that `readCsvRecords` itself does NOT enforce - the format parsers do, against the
    reader's output. The test asserts the constant values and documents that the reader reads a
    row-cap-exceeding file in full (rejection is upstream), rather than asserting a cap the reader
    does not own. Verified empirically against the source before writing.
- **#199 (PR #<this>, merged on green).** New `lib/schemas/profile.test.ts` mirroring the existing
  `lib/schemas/*.test.ts` style: 34 tests for `profileUpdateSchema` - bodyweight 20-300 (19.9/20/
  300/300.1, decimals allowed), heightCm 100-250 (int-only), weeklyFrequency 1-14 (int-only), each
  edge accepted / just-outside rejected; all native-enum values accepted + junk rejected (Sex/
  TrainingGoal/WeightUnit), nullable-vs-optional split (unit is optional-not-nullable); coachNote at
  vs over `COACH_NOTE_MAX_LEN` with length measured after trim; displayName trim + min-1 + max-80;
  unknown keys stripped (default Zod object).
  - *Contract clarified:* an all-whitespace `coachNote` trims to `""` at the schema level; the
    null-coercion is the route's job (per the schema comment), so the test asserts `""` here, not
    null. Verified empirically before asserting.

**Challenged.** Test-only PRs with no production behavior change -> no subagent review per the run
directive. The substitute discipline (read source, assert real contract empirically, never weaken)
was applied; both green-gates passed (`bash scripts/verify.sh`: prisma generate + lint + typecheck
+ unit + build) and full CI was green (lint/type/unit, integration, build, E2E, docker-smoke).

**Deferred.** Nothing. No production bug surfaced.

---

## 2026-06-13 - Records board, superset rest timer, coach note (#190/#189/#188)

**Context.** Maintainer tick, strictly serialized by ascending size (each PR MERGED before the
next branch was cut). All three issues authored by JulienAu, trust-gated (login allowlist +
collaborator check HTTP 204). Inherited model this cycle (Fable unavailable) - fine, proceeded.
Repo is on Next.js 15 / React 19; followed the existing async-request-API patterns.

**Decided / shipped.**
- **#190 (PR #192, merged).** A display-only Records board on the progress page: per strength
  exercise, the all-time heaviest working set (weight x reps + date) and the best estimated 1RM
  (Epley + date). New pure `exerciseRecords` in lib/records.ts, one bounded extra query over the
  user's full set history (category != CARDIO at the query, warm-ups excluded in the derivation),
  bodyweight effective-load applied by the caller like the rest of the page. Sorted
  alphabetically; ties keep the earlier date; the card hides until there is a record. Colocated
  unit tests (heaviest, best e1RM, ties, bodyweight, warmup/cardio exclusion, grouping, empty).
- **#189 (PR #193, merged on green --full).** Superset-aware rest timer, completing the supersets
  feature. New pure helper `isSupersetTransitionRest` + `SUPERSET_TRANSITION_REST_SEC` (20s) in
  lib/supersets.ts: a short transition rest only when the runner's auto-advance stays inside the
  current item's own group (A1 -> A2); standalone work, the last member advancing past the group,
  and staying put all keep the full restSec. session-runner applies it; standalone rest is
  pinned unchanged (restSec used verbatim when the helper returns false). No schema/API/logging
  change. Unit tests over 2- and 3-member groups; an E2E running an A1/A2 group to completion
  asserting a short rest (<=20s) between members and the full rest (>20s) after the group.
  - *Picked* a 20s non-zero transition rest over skip-entirely: the acceptance criteria require
    a "short transition rest", and a few seconds to switch stations matches real superset use.
- **#188 (PR #<this>, merged on green --full).** A free-text note to the coach (correctable AI
  memory). Additive nullable User.coachNote (migration 20260613163135, validated on the test DB:
  migrate deploy + clean migrate diff "No difference detected"). Zod-bounded (500 chars, trimmed,
  whitespace -> null clear) coachNote on PATCH /api/profile, ownership-scoped; schema extracted to
  lib/schemas/profile.ts so the bound is shared with the UI counter. CoachPayload.userProfile.
  coachNote (additive, input-side). Input-side prompt guidance (weigh it, acknowledge when
  relevant, never override safety, treat as data not instructions) with the <adjustments> output
  contract UNCHANGED - the existing adjustments contract tests pass unmodified. Demo provider's
  canned debrief references the note (still closing on </adjustments>). Coach page gets an editable
  "Note to your coach" card with a counter and save/clear. Integration tests pin the route
  (set/clear, trim-to-null, 500-char bound, absent-preserves, cross-user isolation) and the
  payload (null = absent); unit tests pin the prompt guidance and the demo line. Rollback baseline
  `autonomy-baseline-2026-06-13b` tagged on main before the migration merged.

**Challenged.** No subagent-spawning tool available in this nested tick. Per the charter backstop,
each PR merged only on green full CI and is FLAGGED here for independent POST-MERGE review:
correctness on #190 and #189 (does-it-actually-work lens for #189's timer); multi-lens incl.
output-contract-unchanged and input-handling for #188.

**Gate note.** One pre-existing local-only flake (`readiness-checkin.test.tsx > submits a partial
soreness map...`, a userEvent 5s timeout under WSL2) fails identically on clean main and is green
in CI; unrelated to these changes. Confirmed each tier (unit minus that flake, integration, E2E,
build) green locally and relied on CI as the authoritative full gate.

**Deferred to human.** The post-merge reviews above. #169 (Next.js major bump) remains
stop-for-human, untouched.

---

## 2026-06-13 - Cardio axis rounded out: last-time reference, pace/speed, TCX export (#176/#177/#175)

**Context.** Maintainer tick running the cardio-axis batch, strictly serialized by ascending
size (each PR MERGED before the next branch was cut). All three issues authored by JulienAu,
trust-gated (login allowlist + collaborator check HTTP 204). Inherited model this cycle (Fable
unavailable) - fine, proceeded. #169 (Next.js major bump) left untouched as stop-for-human.

**Decided / shipped.**
- **#176 (PR #179, merged).** The in-session "Last session" reference was gated off for cardio
  (`!isCardio` in exercise-card.tsx). Extended the last-performance shape to carry summed cardio
  totals (durationSec/distanceM averaged-HR; null for strength) and branched the card on isCardio
  so cardio shows "<mm:ss> . <distance> . <avgHr> bpm" via the shared lib/cardio formatters.
  Display-only, no schema/API/prompt change. Component tests cover the cardio branch (full data,
  duration-only, no-history, defensive no-cardio-record); integration test pins the totals math.
- **#177 (PR #180, merged).** Pure, unit-aware pace/speed derivations in lib/cardio.ts
  (paceSecPerKm, speedKmh, formatPace, formatSpeed) returning null on zero/absent distance - no
  divide-by-zero, no NaN/Infinity. Surfaced on the post-session summary recap and the history
  detail (totals + a per-set Pace column), in the user's unit (min/km+km/h metric, min/mi+mph
  imperial). Display-only. Colocated unit tests (metric/imperial/zero) + summary component tests.
- **#175 (PR #181, merged on green --full).** The outbound half of data ownership: GET
  /api/cardio/tcx?sessionId=... emits a minimal valid TCX 1.0 Activity (one Lap per cardio set),
  ownership-scoped exactly like the CSV export (foreign session -> 404; 400 on a non-cardio
  session or missing sessionId). Pure serializer lib/import/tcx-export.ts emits a FIXED minimal
  structure (no DTD/entities) and xmlEscapes the five XML metacharacters on every interpolated
  value; sport mapping is the inverse of the import's name<->sport. A "Download .tcx" action
  sits on the finished-session detail page, shown only when the session has cardio.
  - *Deviation noted:* the issue named app/(app)/session/[id] for the button, but that route
    redirects finished sessions to home; the session-detail surface that actually renders a
    completed session is app/(app)/history/[id], so the action landed there (the issue's clear
    intent - download a completed cardio session from its detail view).
  - Round-trip test (serializeTcx -> parseTcx) pins identical duration/distance/avgHr; xmlEscape
    unit tests cover all five metacharacters and a markup-injection attempt; integration tests
    pin ownership (404), cardio-only (400), missing-sessionId (400), and the round trip through
    the route. Complex change (new route + new surface), so ran verify.sh --full before the PR.

**Challenged.** No subagent-spawning tool available in this nested tick. Per the charter
backstop, each PR merged only on green full CI and is FLAGGED here for independent POST-MERGE
review: correctness lens on #176/#177; correctness + an XML-escaping/ownership lens on #175.

**Deferred to human.** The post-merge review above. #169 (Next.js major bump) remains
stop-for-human, untouched.

---

## 2026-06-12 (day) - Backup export/restore made complete (#168)

**Context.** Maintainer tick on issue #168 (author JulienAu, trust-gated: login allowlist
plus collaborator check HTTP 204): the backup route - the data-ownership wedge - silently
dropped everything added since it shipped. Data-integrity work, so the reinforced
controls applied: full local gate, tests at every touched layer, no migration needed
(purely additive).

**Decided / shipped.**
- app/api/backup/route.ts rewritten against a systematic schema inventory (now documented
  in the route header): export gains Set.durationSec/distanceM/avgHr,
  ProgramExercise.supersetGroup, Exercise.usesBodyweight (a fourth silent drop the issue
  had not listed), the profile incl deloadUntil, and the ExerciseGoal / BodyweightEntry /
  ReadinessCheckin / Conversation+Message models. VERSION bumped to 2; version 1 files
  keep importing (every v2 field/model is optional, defaulting to null/absent).
- Restore hardened as untrusted input: 50 MiB streaming byte cap (readBodyWithCap),
  bounds on every value reusing the writer schemas' limits (cardio caps, superset group
  range, profile ranges, soreness map), array caps, dates must parse (400 instead of a
  Prisma 500), enum fields validated with nativeEnum instead of the old `as any` casts.
  The transaction (still all-or-nothing) now also purges/recreates the new models.
- tests/integration/backup-route.test.ts: lossless round trip into a SECOND user
  (field-for-field, order-insensitive re-export comparison) with ownership assertions;
  a version-1-file restore; and adversarial cases - out-of-bounds value, non-JSON,
  missing confirmReplace, mid-transaction unique-violation rollback leaving prior data
  byte-identical, 50 MiB+ body (413), 20k+ array (400).
- Full local gate (verify.sh --full) before the PR.

**Challenged.** No subagent-spawning tool in this tick: per the charter backstop the PR
merged on green full CI and is flagged for independent POST-MERGE review - correctness
lens on the round trip and a security lens on the untrusted restore path.

**Deferred to human.** Post-merge review above. #169 (major-version dep bumps) remains
stop-for-human from the previous tick.

---

## 2026-06-12 (night) - TCX hardening nits land (#161); triage follows

**Context.** Maintainer tick. One implementation item: issue #161 (the advisory nits the
hostile security review of #158 suggested for the TCX importer). Author JulienAu,
trust-gated (login allowlist + collaborator check HTTP 204). Additive, no migration.

**Decided / shipped.**
- PR closing #161: lib/import/tcx.ts now strips XML comments before any scanning (indexOf
  single pass; an unterminated comment drops the rest, like a real parser), so a
  comment-smuggled <Activity> is never seen and a commented-out DTD is correctly treated
  as inert and accepted. The advisory DTD reject is tightened: after comment stripping,
  any "<!" not followed by a letter (null-byte-split <!DOCTYPE, <![CDATA[, bare <!>) is
  rejected as a malformed markup declaration. startedAt is clamped to 2000-01-01 .. now +
  1 day (small clock skew tolerated). New fixtures lock every verified behavior in:
  comment smuggling, commented DTD, unterminated comment, null-byte-split DOCTYPE,
  CDATA, exponent/hex/Infinity/NaN numerics (notation cannot bypass the bounds), the
  clamp boundaries, and a route-level re-confirm inside the duplicate window creating a
  deliberate second session while reusing the exercise.
- Full local gate (verify.sh --full) before the PR; PR #167 merged on green 5-check CI.

**Challenged.** No subagent-spawning tool available in this tick: per the charter's
no-self-certification backstop, the PR merged on green full CI and is flagged for an
independent POST-MERGE review (security lens - it touches the untrusted-XML parser).

**Deferred to human.** Triage ran after the merge (this amendment rides in a docs PR):
- Filed #168: the backup export/restore route silently drops everything added since it
  shipped (Set.durationSec/distanceM/avgHr, ProgramExercise.supersetGroup, and the
  ExerciseGoal / BodyweightEntry / ReadinessCheckin models) and has zero integration
  coverage - the L8 silent-data-loss class on the one route meant to prevent it.
- Filed #169 (STOP-FOR-HUMAN): npm audit reports 6 high / 1 moderate advisories, all
  fixable only by major bumps - next 14.2.35 needs >=15.5.16 for its runtime advisories;
  the eslint-config-next/glob and next-pwa/workbox chains are dev/build-time. Per the
  charter the loop must not auto-implement this; the issue records the decision needed.
- Not due / nothing to file: gate spot-check (last run 2026-06-11); permissions re-audit
  (hardened 2026-06-09; deny list re-read this run and intact - rm -rf, force-push
  variants, reset --hard, curl, wget all still denied; no allow-list scope creep found).

---

## 2026-06-12 (evening) - Seventh batch: research-grounded; one trust fix; UTC helpers settled

**Context.** The operator funded a deeper research pass this cycle (~26 searches, Opus).
It produced the hybrid-athlete/file-import direction and five recorded
anti-recommendations; ideate filed #152/#153/#154 from it; a Fable tick shipped them as
#156/#157/#158 (3/3 budget, baseline 2026-06-12b tagged, one E2E strict-mode fix).

**Decided / shipped.**
- Reviews (Opus): #158 CLEAN under hostile attack (DOCTYPE bypass proven inert, 5MB
  adversarial inputs linear, bounds airtight); #157 CLEAN; #156 one REAL - the
  transparency footer overclaimed privacy. Fixed same-day (#162). The thrice-flagged
  ISO-week local-time skew fixed for every consumer (#163, verified under a non-UTC TZ).
  TCX advisory nits filed as #161 (good first issue).
- Write-up: CHANGELOG/README (TCX import is the headline), backlog verdicts, demo seed
  superset pairing, all four clips re-recorded (staleness cap reached), demo redeploy.

**Challenged.** Three independent reviews, model-split. Accepted-change rate: 5 merged /
0 abandoned this batch (plus docs).

**Deferred to human.** Nothing. #161 awaits a normal pick-up; FIT/GPX import, maxHr, and
coach-context annotation are future slices.

---

---

## 2026-06-12 (third run) - Seventh batch ships: coach transparency (#154), interference awareness (#153), TCX import (#152)

**Context.** Maintainer tick executing the seventh ideate batch, strictly serialized by
ascending size, each PR merged on green full CI before the next branch was cut. All three
issues authored by JulienAu (trust-gated). No subagent-spawning tool available in this
tick, so per the charter's no-self-certification rule every PR merged on green full CI and
is flagged for an independent POST-MERGE review by the orchestrator.

**Decided / shipped.**
- PR #156 (Closes #154): "What your coach sees" transparency card on the coach page,
  collapsed by default. Display-only: the page calls the SHARED buildCoachPayload and a
  pure mapper (lib/coach-context.ts) reshapes it - no duplicated derivations, no prompt or
  payload change (payload tests untouched). Unit + component tests incl. fresh-user empty
  states. Fast gate green locally; CI green; merged. Post-merge review lens: correctness.
- PR #157 (Closes #153): per-day conditioning for hybrid interference awareness.
  `conditioning.days` (current ISO week, `{ date, minutes, km }`, zero days omitted -
  documented as the compact choice) via a new shared dailyConditioning derivation in
  lib/stats.ts over the already-fetched sets. Input-side prompt guidance only (flag hard
  cardio adjacent to heavy lower-body days, explain why, prose only); demo provider gained
  one interference line. Purely additive diff; the adjustments contract tests passed
  UNMODIFIED. Full gate green locally; CI green; merged. Post-merge review: multi-lens.
- PR #158 (Closes #152): TCX file import as one cardio session - the riskiest item
  (untrusted XML). Security bar implemented as specified: lib/import/tcx.ts is a minimal
  indexOf-based extractor over the narrow TCX shape, NOT an XML parser - no entity table,
  no entity decoding, so XXE and billion-laughs are impossible by construction; any
  `<!DOCTYPE`/`<!ENTITY` rejected outright; value/attribute scans capped; hostile fixtures
  in tests (internal DTD, external entity, entity bomb, truncated file, huge attributes,
  oversize). Decision documented in-module: no XML dependency added - a general parser IS
  the attack surface and the TCX subset needed is tiny. Additive Set.avgHr migration
  (bounds 40..250 enforced in the set schema, the sets route and the importer) validated
  on the test DB (migrate deploy + clean migrate diff); fresh rollback baseline
  `autonomy-baseline-2026-06-12b` tagged on main before merge. Route mirrors the hardened
  CSV imports: shared `import:userId` rate bucket, streamed body cap, dry-run preview with
  a +/-2 min near-duplicate warning, transactional confirm, ownership-scoped exercise
  reuse (409 on a non-cardio name conflict, nothing written). avgHr renders in the session
  detail; the conditioning card and coach payload pick imported sessions up automatically.
  Tests at every layer (parser unit incl. hostile, route integration, E2E
  upload -> preview -> confirm -> history detail). Post-merge review: SECURITY (mandatory).

**Challenged.** No in-tick independent reviewer could be spawned; the charter's backstop
applies - all three PRs are explicitly queued for post-merge independent review
(correctness #156, multi-lens #157, security #158).

**Deferred to human / next run.** The three post-merge reviews. FIT and GPX import are
later slices; maxHr deferred; TCX exercise picker (user-chosen target exercise) deferred -
the Sport-based default shipped.

---

## 2026-06-12 (later) - Sixth batch: zero-finding reviews; supersets land; two process lessons

**Context.** Sixth ideate batch (#144 export columns, #145 coach conditioning, #146
supersets slice 1) implemented across two ticks (the first died waiting on CI - lesson L3
relearned - and later re-woke as a concurrent writer during #145 - new lesson L11).

**Decided / shipped.**
- #148/#149/#150 all merged on green full CI; all three independent Opus reviews CLEAN -
  the first zero-REAL-finding batch. The #150 reviewer proved the A1/A2 flow live on a
  production build and exhaustively verified the no-trap navigation property; the #149
  reviewer ran an injected-code scan after the zombie episode (nothing foreign).
- Lessons graduated: L11 (stop a crashed tick before relaunching into the same checkout;
  06-orchestration.md gains the relaunch-after-crash rule) and the L3 reminder is now
  injected into tick prompts (poll CI in-process, never end a run "waiting").
- Write-up: CHANGELOG, README (supersets, coach conditioning, export round-trip),
  backlog verdicts, this entry. Captured pages unchanged (builder/session-runner are not
  screenshot subjects); clips within the staleness cap. Demo redeploy follows the merge.

**Challenged.** Two independent reviews, model-split. Accepted-change rate: 3 merged /
0 abandoned (plus 2 docs PRs).

**Deferred to human.** Nothing. Superset slices 2+ (shared rest, circuit timer), pace
analytics, and cardio drill-down stay un-filed for the next starved cycle.

---

---

## 2026-06-12 - Coach conditioning payload (#145) + supersets slice 1 (#146) shipped

**Context.** Maintainer tick executing the remaining two issues of the sixth ideate
batch, strictly serialized (PR merged before the next branch). Both issues authored by
JulienAu (trust-gated, collaborator-verified 204). PR #148 (#144, cardio CSV export) had
already merged.

**Decided / shipped.**
- PR #149 (Closes #145): dedicated `CoachPayload.conditioning` section -
  weekCurrent/weekPrevious `{ minutes, km, sessions }` plus the 150 min/week guideline -
  computed via the SHARED lib/stats.ts weeklyConditioning derivation over the
  already-fetched recent sets (no duplication). Input-side prompt guidance only; the
  `<adjustments>` output contract untouched and its tests passed unmodified. Demo
  provider's canned debrief exercises the section. Tests: prompt positioning, demo
  contract-closure pin, integration suite (aggregation, zero-cardio user -> zeros + null
  weekPrevious, isolation). Full local gate green before the PR; CI green; squash-merged.
- PR #150 (Closes #146): supersets slice 1, program-level only. Additive nullable
  `ProgramExercise.supersetGroup` migration validated on the test DB (migrate deploy +
  clean migrate diff); rollback baseline `autonomy-baseline-2026-06-12` tagged on main
  before merge. All user-facing semantics derive on read in the new pure lib
  (`lib/supersets.ts`): A1/A2/B1 labels, presentation order (group members consecutive),
  auto-advance alternation, Next-button cycling that never traps the user in an
  unfinished group. Builder gains pair-with-previous / unpair menu actions riding the
  existing PUT route (absent field preserves pairing, null unpairs - pinned). Logging
  semantics, rest timer, generation/templates/imports/coach payload untouched. Tests at
  every layer: 14 unit (derivations), schema bounds, route integration (persistence,
  absent-vs-null, ownership), new E2E pairing two exercises and running the A1/A2 flow;
  standalone flows pinned by the existing suite plus explicit pinned-behavior unit cases.
- One local typecheck red on the way (stale `.next` types; cleared) and one expected
  fixture fallout (ProgramExercise test fixtures gained `supersetGroup: null`) - no
  assertion weakened.

**Challenged.** No subagent spawning available in this nested run, so per the charter's
no-self-certify rule both PRs merged on green FULL CI (integration + E2E) and are flagged
for independent post-merge review: multi-lens for both, does-it-actually-work for #146.

**Deferred to human.** Nothing blocked. Later superset slices (shared-rest enforcement,
circuit timer, logging semantics, generation/template awareness) stay un-filed until a
starved cycle.

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

---

## 2026-06-13 - Cardio axis closed out (#175/#176/#177); model note + three CLEAN reviews

**Context.** Eighth ideate batch (#175 TCX export, #176 cardio last-time, #177 pace/speed) implemented and shipped. Operator switched the default model to Opus 4.8; the Fable model then became unavailable to subagents, so this cycle's dev tick ran on the inherited Opus (the Fable-for-dev routing is moot while Fable is inaccessible) - noted so a future run does not treat the routing as broken.

**Decided / shipped.**
- #179/#180/#181 merged on green full CI; all three independent Opus reviews CLEAN (the #181 TCX-export review attacked escaping/ownership/2000-lap perf and the round trip - all held; the #180 pace/speed math was re-derived independently). Three NITs on #181 (unreachable non-finite/zero-HR emission, finished-session button gate) hardened in #182; one pre-existing cross-cutting NIT (history cardio totals include warmups) filed as #183.
- The cardio axis is now closed in and out: TCX/CSV import -> first-class cardio logging with a last-time reference -> pace/speed + conditioning analytics -> TCX/CSV export. This is the file-based neutral ground the 2026-06-12 research identified as the hybrid-athlete white space.

**Challenged.** Two parallel Opus reviews (one security-lensed). Accepted-change rate: 4 merged / 0 abandoned (+ docs).

**Deferred to human.** #169 (Next.js 14->15 major bump) still stop-for-human, untouched. Future: #183 (warmup totals), supersets slice 2, coach-context annotation.

---

## 2026-06-13 - Next.js 15 + React 19 upgrade (#169), operator-authorized

**Context.** #169 (the Next 14->15 major bump) is normally stop-for-human; the operator explicitly authorized it ("go #169, I trust you, be careful"). Done by the orchestrator directly (not a fire-and-forget tick) given the risk. Rollback baseline autonomy-baseline-2026-06-13-next15 tagged first.

**Decided / shipped (PR #185, merged on full green incl. docker-smoke).**
- next 15.5.19, react/react-dom 19, @types/react(-dom) 19, eslint-config-next 15.
- next-pwa (unmaintained, no Next 15) -> @ducanh2912/next-pwa (workboxOptions, buildExcludes->exclude). The PWA blocker was the crux; everything else (Radix, recharts 3, next-themes, testing-library 16) was already React-19 ready.
- Async request APIs via the official codemod (cookies in lib/auth; params/searchParams across 23 routes/pages); integration tests updated to Promise.resolve({params}).
- The 14 runtime Next CVEs from #169 are cleared; residual advisories are build-time only (workbox/esbuild-via-vitest/next-bundled-postcss) - accepted.

**Verified (reinforced controls for a major bump).** verify.sh --full green (incl. 10 E2E); production Docker image built + probed locally (login 200, sw.js 200, no client error); CI docker-smoke re-validated the image; demo redeployed and the LIVE Next 15 instance confirmed healthy (login, full progress data, service worker, zero page errors). Lesson L13 records the approach.

**Deferred to human.** None outstanding from #169. A Serwist migration (to clear the build-time workbox advisories) is a possible larger follow-up, not filed.

---

## 2026-06-13 (late) - Batch 9 shipped (#188/#189/#190); 3 CLEAN reviews + one tie-break fix

**Context.** Ninth ideate batch implemented on Opus (Fable still unavailable to subagents): coach note (#188), superset-aware rest (#189), records board (#190).

**Decided / shipped.**
- #192/#193/#194 merged on green full CI; rollback baseline autonomy-baseline-2026-06-13b tagged before the #194 migration. Three independent Opus reviews: all CLEAN. The #188 review verified the coach note reaches the LLM as JSON DATA (not concatenated into instructions), the <adjustments> contract is byte-identical, and adversarial notes (</adjustments>, "ignore instructions", 501 chars, whitespace) are handled. The #193 timer was proven live via the superset E2E. The #190 review found one NIT (non-deterministic tie-break date, no orderBy) - promoted to fix #195/#196 (query ordered oldest-first; tests pin the contract).
- The coach note is the correctable-memory differentiator the 2026-06-12 research identified; it pairs with the read-only transparency card (#154).

**Challenged.** Two parallel Opus reviews (one injection-lensed). Accepted-change rate: 4 merged / 0 abandoned this batch.

**Deferred to human.** Nothing outstanding. Future: mobility session type (low confidence), Serwist migration (build-time advisories).

---

## 2026-06-15 - Batch 10 (#202/#203/#204): a maintainer tick died mid-run; resumed without loss

**Context.** Tenth ideate batch (body measurements #202, cardio max HR #203, GPX import #204). The implementing tick (inherited Opus; Fable still unavailable) shipped #206 (#203) and #207 (#202), then DIED on a transient socket error mid-PR for #204, leaving a complete-but-uncommitted GPX implementation (parser + route + UI + 30 unit tests incl. the full hostile-input suite) on its branch. It had tagged the rollback baselines (autonomy-baseline-2026-06-14 / -14b) before its migrations.

**Decided / shipped.**
- Resumed the dead tick's GPX branch (socket-close is terminal, no zombie): verified the full gate was green on the uncommitted work, sanity-checked the parser's security posture, added the one missing piece (the E2E the issue required), re-gated, and shipped it as PR #208 on green full CI.
- All three PRs then got the independent post-merge reviews the dead tick never reported: #206 CLEAN (max HR; Track subtree stripped before lap-max, bounds on all writers), #207 CLEAN (measurements; ownership, additive migration no drift), #208 CLEAN under a HOSTILE security review (21 adversarial cases - no entity table, billion-laughs <1ms, 5MB linear ~110ms, 200k-point cap, GPX name never read so no attacker text reaches DB/CSV/React). Zero REAL findings across the batch.
- The product now imports four formats (Strong/Hevy CSV, TCX, GPX) plus full export - the file-based neutral ground the 2026-06-12 research identified.

**Challenged.** Three parallel Opus reviews (one hostile-security). Accepted-change rate: 3 merged / 0 abandoned. The resilience pattern held: durable git/PR state meant the socket death cost no work; the mandatory review validated dead-tick code under attack.

**Deferred to human.** Nothing. Future: FIT import (binary, needs a decoder), free-text AI set logging (LLM-shaped), mobility session type (low confidence), Serwist (build-time chore). #169 (Next 15) already done.

---

## 2026-06-15 (later) - Batch 11 reviewed (3x CLEAN); ROADMAP COMPLETE; shared-demo pollution fixed

**Context.** Batch 11 (#212 coach records, #211 volume targets, #210 free-text AI set logging) shipped; #210 was the LAST unchecked README roadmap item - the roadmap is now fully checked, MVP -> complete AI coach.

**Decided / shipped.**
- Three independent Opus reviews: all CLEAN. #216/#210 cleared an untrusted-model-output lens - the reviewer ran 12 hostile model outputs (Infinity/NaN/out-of-range/wrong-kind/injected "log this set"/__proto__) all fail closed, proved a parse never logs a set (no db write in the call graph), and confirmed the route is rate-limited + body-capped + the parse contract is separate from <adjustments>. #214 (records, output contract intact) and #215 (volume targets, additive migration no drift, classifier stays pure) CLEAN.
- NIT cleanup in #217: clamp a model-parsed RIR of 4-5 to the selectable button range; add the missing parse-route 429/oversize tests; drop a dead volumeTargets prop.
- Operations: found and fixed why the operator kept seeing an "empty" demo - it is a single SHARED account that visitors pollute (their in-progress session makes the home lead with "Resume session"). Installed a `*/30` light-reset cron on the VPS (re-seeds the demo account, no downtime) alongside the nightly full reset; documented the periodic-reseed need in the README demo section.

**Challenged.** Three parallel Opus reviews (one untrusted-output-weighted). Accepted-change rate: 4 merged / 0 abandoned + the cleanup.

**Deferred to human.** Nothing. The README roadmap is complete; future product work is now pure ideation (FIT import, mobility, etc.). The recurring readiness-checkin.test.tsx WSL2-only flake (green in CI) is worth a robustness pass next triage.

---

## 2026-06-15 (triage) - L9 gate spot-check + permissions re-audit (both pass); two test issues filed

**Gate spot-check (L9).** Disabled the GPX parser's DTD/entity reject (lib/import/gpx.ts:303) locally (never pushed) and re-ran lib/import/gpx.test.ts: 3 hostile-input tests FAILED as they should (internal DTD, external-entity XXE, billion-laughs). The security gate is genuinely protective, not rotten. Restored; tree clean.

**Permissions re-audit (L9).** Re-read .claude/settings.json: the deny list is intact (rm -rf, git push --force/-f/--force-with-lease, git reset --hard, curl, wget). The 37 allow entries are all coherent with what the loop runs (npm/npx/git/gh/file ops); no dangerous scope creep, no sudo/broad-rm/network grants.

**Filed.** #219 (fix the flaky readiness-checkin userEvent test - times out under parallel WSL2 load, green in CI) and #220 (colocated unit coverage for lib/last-performance.ts - the cardio-totals/HR-averaging logic from #179 is only integration-tested). Code markers: none. Roadmap: complete. Coverage otherwise healthy (the untrusted set-parse validation is unit-tested; thin wrappers are integration-covered).

---

## 2026-06-16 - Batch 12 (beyond-roadmap polish): 3 CLEAN + 1 dedup fix

**Context.** First ideation past the completed roadmap - mature-product polish, kept anti-busywork (each a verified real gap, not filler): exercise cues in session (#224), per-muscle frequency (#225), e1RM % loading table (#226). All additive, display-only.

**Decided / shipped.**
- #228/#229/#230 merged on green; one consolidated light correctness review (proportionate to display-only/no-contract risk) returned 3/3 CLEAN - it confirmed the non-vacuous bits: frequency counts distinct calendar days (not raw sets) and the loading table converts kg->display unit BEFORE rounding so loads land on real plate jumps. One NIT (the exercise note rendered twice - cue + collapsible) fixed in #232 (#231): the collapsible now holds only the program-specific note.
- The product is feature-complete on its vision; ideation is now polish/completeness. Deferred unchanged: FIT import, mobility session type, Serwist.

**Challenged.** One consolidated Opus correctness review (right-sized for low risk). Accepted-change rate: 4 merged / 0 abandoned.

**Deferred to human.** Nothing. Process note: the in-loop CI poll briefly merged two docs/1-file PRs on "no checks reported" before the workflow registered; both were locally full-gate-green and confirmed green on main post-merge - harden the poll to treat "no checks reported" as wait, not proceed.

---

## 2026-06-17 - Maintenance: demo deploy flipped to a reliable PULL model

**Context.** The GitHub-runner-SSH-in demo deploy (deploy-demo.yml) had been timing out at the connection level from shared runner IPs more often than it succeeded - I had to redeploy directly from the VPS most cycles, and the weekly scheduled run showed as recurring red noise. Diagnosed: connection-level timeout (runner SYN to :22 not getting through), not auth/fail2ban (0 banned, VPS reachable from a fixed IP) - GitHub egress flakiness to a small VPS, unfixable from the workflow side.

**Decided / shipped.**
- Flipped PUSH -> PULL. New VPS cron /home/gymdeploy/bin/auto-deploy.sh (every 2h, `17 */2 * * *`): git-fetches main and runs deploy-demo.sh ONLY when main moved - a host reaching out to GitHub is reliable where CI reaching in is not. Tested end-to-end: it detected main d3ea405 -> b48841f and redeployed; the live demo verified clean+healthy on the new code.
- deploy-demo.yml is now workflow_dispatch-only (#234) - dropped the flaky weekly schedule + its red runs; manual dispatch stays for on-demand. README documents the pull-model preference; memory readme-and-demo-media.md updated with the new commands.
- Also corrected stale "Next.js 14" references to 15 across README + CLAUDE.md (#235) - the repo upgraded in #185.

**Challenged.** Self-verified (infra + docs only): pull-model proven end-to-end, both PRs green on full CI. No subagent review needed.

**Deferred to human.** Nothing. The recurring "I redeploy by hand each cycle" toil is now eliminated; future demos self-update within 2h of a merge.

---

## 2026-06-18 - Batch 13 (beyond-roadmap): proactive home insight + catalog search

**Context.** Idle loop, roadmap complete, backlog empty. Ideated two genuinely-new, single-PR, display-only gaps (not filler): the home dashboard was purely navigational despite the app already deriving rich signals (#237), and the exercise catalog had no search as custom exercises accumulate (#238). Filed both; deliberately did NOT manufacture a weak third.

**Decided / shipped.**
- #238 catalog search (PR #239): pure client-side name filter over the loaded list in components/exercises/exercises-view.tsx, grouping preserved, distinct no-match vs catalog-empty states. 5 component tests.
- #237 home coach insight (PR #240): new lib/home-insight.ts with a PURE `selectHomeInsight` (priority recommended-deload > stalled-lift > fresh-PR > on-track) and a server `getHomeInsight` that composes existing derivations (isStalled/exerciseProgress, recommendDeload, exerciseRecords, isoWeekStart). Display-only, no LLM, no writes; null on a fresh account. 8 unit tests on the selector.
- #241 docs/media: README feature bullets + re-shot home.png (insight card) and catalog.png (search box) against a production build with the deterministic 12-week seed, self-verified healthy.
- Demo force-redeployed to 209b29a (pull-model) and verified live (/login 200).

**Challenged.** #237 (the more complex change, on the home render path) got an independent general-purpose review: verdict SHIP, all checks OK (PR detection mirrors the progress page's records query exactly; bodyweight inline matches effectiveWeight; stall grouped by name is safe given @@unique([userId, name]); ~6 bounded queries, no N+1; empty path renders nothing). Two harmless NITs, no action. #238/#241 self-verified (low risk). Accepted-change rate: 3 merged / 0 abandoned.

**Deferred to human.** Nothing actioned. The deploy output reflagged the Prisma 5.22 -> 7.8 major bump - left as stop-for-human (major dep bump), not auto-taken.
