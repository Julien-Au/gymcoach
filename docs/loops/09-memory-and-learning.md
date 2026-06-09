# 09 — Memory, learning, and regrounding (the loop as a control system)

The first eight files describe *what* runs. This one describes how the system **remembers,
learns, and stays pointed at its purpose** across many disposable sessions. It is the
answer to three questions any long-running agent has to answer: how do you manage and
compress context, how do you learn from experience, and how do you keep the agent grounded
in why it exists.

The unifying frame is **cybernetics**: the loop is a feedback control system, not a chatbot
with a long memory. (Frame drawn from *Agent Cybernetics Is the Missing Science of
Foundation Agents*, arXiv 2605.10754, plus Anthropic's context-engineering posts.)

```
   setpoint (purpose)                                     primary purpose:
   CLAUDE.md + 07-autonomy.md  ─────────────────────────► the most complete
        │  re-read each tick (regrounding)                 self-hosted AI fitness app
        ▼
   controller ──► actuators ──► the repo ──► sensors ──► error signal ──┐
   06 decision   skills        (the plant)   gh / CI /   gap to vision   │
   -maker        02-05,08                     git / code  + green-gate    │
        ▲                                                                 │
        └──────────────── negative feedback (green-gate / CI) ◄───────────┘
                          nothing lands until the error is corrected
```

- **Setpoint** = the product vision + the charter. The thing we steer toward.
- **Controller** = the maintainer decision-maker (`06-orchestration.md`).
- **Actuators** = the skills (triage, ideate, implement-issue, ship-pr, write-up).
- **Sensors** = `gh` issue/PR state, CI results, the codebase, the green-gate.
- **Error signal** = the gap between the current product and the vision (what triage/ideate
  surface) and the gap between a change and "correct" (what the gate catches).
- **Negative feedback** = `scripts/verify.sh` + CI. The loop never lands on optimism; the
  gate corrects error before it reaches `main`.

## 1. Context management and compression

**There is no separate "compress my memory" daemon, and there should not be.** Compression
is *structural*: the session is disposable RAM; the durable state lives in the repo.

Karpathy's LLM-OS analogy is the working model: the **context window is RAM** (scarce,
curated), the model is the CPU, and **the repo + git + GitHub are the disk** that must be
explicitly paged in. So:

- **State lives in git + GitHub + files, never only in a session.** Branches, issues, PRs,
  the autonomy log, CHANGELOG, and `ideas-backlog.md` *are* the memory. A crash mid-run
  loses nothing; the next tick re-reads reality.
- **Just-in-time retrieval, not pre-loading.** Page context in on demand with `grep` /
  `glob` / `gh` / `git` / reading a file by path. Do not dump the repo into the window.
  (Anthropic, *Effective context engineering*; this is also why grep + git beat a vector DB
  for code we control - see section 2.)
- **Cold start + regrounding each run.** A tick begins by reading the setpoint (CLAUDE.md +
  charter), the open state (`gh`), and recent lessons, then does bounded work. The window
  never has to hold the whole history because the history is on disk.
- **Subagent context isolation.** Deep reads, research sweeps, and the skeptic review run in
  subagents with their own windows; they return a small summary (~1-2k tokens), keeping the
  main thread clean. We use subagents for *read/investigate fan-out*, not parallel writers
  (see "one writer" below).
- **Compaction is the fallback, not the strategy.** If a single run does grow long,
  summarize preserving decisions + open threads and drop redundant tool output. But the
  structural answer (externalize, start cold) means we rarely need it.

**One linear writer thread per task.** Concurrency at the *stage* level is fine and is what
"orchestration loops, concurrently" (`00-concept.md`) means - `06` can have ship draining
one PR while implement works another. What we avoid is **two writers on the same task or
racing `main`**: one writer per task/branch. Subagents investigate and return summaries; the
main thread (or one delegate) writes and merges, sequentially. Cognition (*Don't build
multi-agents*) argues parallel writers make conflicting implicit decisions with no clean
cross-agent context sharing; this repo hit the same edge - two feature branches cut from the
same `main` and merged close together were each green alone but needed a re-check combined,
so we ship one at a time and let the gate run on the merged result.

## 2. Self-learning (layered memory that graduates into procedure)

Memory is layered, and the repo already gives us most of it for free:

| Layer | What it is | Where it lives |
| --- | --- | --- |
| Working | the current context window | the session (disposable) |
| Episodic | what each run decided and why | `autonomy-log.md` + git history |
| Semantic | durable facts about the product | `CLAUDE.md`, `docs/`, CHANGELOG, the research memory |
| Procedural | how to act well | the **skills** (`.claude/skills/*`) |

Retrieval across all of them is `grep` / `git` / `gh` by index (date, issue, PR, path) -
**no vector database**. For a single repo we control with a large window, files + grep are
faster, cheaper, debuggable, and benchmark *higher* on correctness than embeddings
(LlamaIndex; Shaped.ai). We would only add retrieval-by-embedding if the knowledge base
became a large, unstructured, un-greppable corpus - which it is not.

**The learning mechanism is reflection that graduates into procedure** - the graduation step
(promoting a lesson into a skill) is our own design, informed by Reflexion (arXiv 2303.11366)
and Generative Agents (arXiv 2304.03442). An append-only log is good *episodic*
memory but a poor *behavior-change* mechanism: a lesson buried in a deep log no one re-reads
changes nothing. So a lesson is only "learned" when it is **promoted** to where it will be
retrieved at the relevant moment:

`docs/loops/lessons.md` is the **staging area**. Every lesson there must end in one of:

1. **Graduated** - the lesson edited a **skill** or **CLAUDE.md** / the charter, so the
   behavior changes automatically next time (this is the goal). The lessons-file entry then
   just points at the change.
2. **Accepted risk** - we chose not to change procedure; the entry records the decision and
   why, so we do not relitigate it.

A lesson must be **specific and actionable** ("after a red gate, write a one-line diagnosis
of the failing step before editing", not "be careful"), and the file is **pruned/deduped**
so it stays high-signal. Write-up (`05`) harvests new lessons each run and graduates the
general ones.

## 3. Regrounding (staying pointed at the purpose)

Long autonomous runs drift. Three cheap mechanisms keep the loop anchored (all from the
cybernetics paper + Anthropic's long-running-harness guidance):

- **The setpoint lives in an external, compaction-proof file.** `CLAUDE.md` + the charter
  are the source of truth for "what this project is for". Summarization can dilute the
  window; it cannot dilute the file. Regrounding always reads from there.
- **Self-monitoring driving a two-loop homeostasis** (the paper's highest-value,
  lowest-cost intervention, and the one most agents skip): a *fast inner loop* works the
  issue while you watch your own action history for failure signatures - the same edit
  retried, N consecutive red gates, a PR re-opened by an untrusted author, a task that maps
  to no goal in the charter. When one fires, a *slow outer loop* kicks in: stop, re-read the
  setpoint, reground, or hand to a human. The existing caps (3 merges/run, 3 fix attempts,
  anti-flood, halt-on-idle) are the stability controls that keep this from oscillating.
- **Acknowledge feedback before re-planning** (anti "feedback blindness"): read the actual
  green-gate / CI / issue output and state what it says before deciding the next step. Do
  not plan past a failure signal.

The same grounding principle applies to the **human**: the loop ships faster than anyone
reads, so `docs/loops/review-digest.md` is a per-batch prioritized reading list (auth /
security / schema / core behavior / prompts / CI first) that `write-up` appends to. It is
the antidote to *comprehension debt* - the skeptic sub-agents gate correctness, but
"reviewed by an agent" is not "understood by the human", and a smooth loop widens that gap
unless the human reads the diffs that matter.

## 4. What we deliberately do NOT build (anti-hype)

Capability we considered and rejected *at this scale*, with the trigger that would change
the call:

- **Vector RAG / embeddings over repo knowledge** - grep + git + `gh` are faster, cheaper,
  auditable, and score higher for code. *Revisit* only if we accrue a large, unstructured,
  un-greppable doc corpus.
- **MemGPT-style paging machinery / external memory services (Mem0, etc.)** - filesystem +
  compaction already give hierarchical memory; the extra infra mainly adds a silent
  staleness failure mode. *Revisit* if context truly cannot be reconstructed from the repo.
- **Parallel multi-agent writers** - conflicting decisions, no clean context sharing, no
  payoff for one repo (Cognition). Subagents stay read-only fan-out + the skeptic.
- **Unbounded append-only "memory"** - bloat and staleness degrade retrieval. Lessons must
  graduate or be pruned; the log is indexed, not infinite working memory.

## The four rules, here

1. **Feedback** - the green-gate/CI is the error signal; nothing lands until it is green,
   and the agent must acknowledge it before re-planning.
2. **Skills, not prompts** - learning graduates *into* the skills; that is what makes a
   lesson stick.
3. **It must halt** - meta-cognitive stop conditions + the output caps are the stability
   controls that prevent looping and drift.
4. **Durability** - memory is the repo (git + GitHub + files), reconstructable from a cold
   start; the session is disposable.

## Sources

Anthropic: [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
[Long-running harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents),
[Managing context](https://www.anthropic.com/news/context-management).
Karpathy's LLM-OS / "context engineering" framing (context window as RAM).
[MemGPT 2310.08560](https://arxiv.org/pdf/2310.08560);
[Generative Agents 2304.03442](https://arxiv.org/pdf/2304.03442);
[Reflexion 2303.11366](https://arxiv.org/pdf/2303.11366);
[Cognition: Don't build multi-agents](https://cognition.ai/blog/dont-build-multi-agents);
filesystem-vs-RAG ([LlamaIndex](https://www.llamaindex.ai/blog/did-filesystem-tools-kill-vector-search),
[Shaped.ai](https://www.shaped.ai/blog/why-grep-is-beating-your-vector-db));
cybernetics ([Agent Cybernetics 2605.10754](https://arxiv.org/html/2605.10754v1)).
