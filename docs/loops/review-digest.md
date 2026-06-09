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
