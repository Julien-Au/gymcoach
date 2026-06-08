# 01 — Foundations (what a loop needs before it can run)

A loop is only as good as the things it calls and the way it checks itself. Before
automating anything, we built four foundations. Each maps to an ingredient from
`00-concept.md`. This is the reproducible setup - copy it into any repo.

## 1. The agent knows the rules: `CLAUDE.md`

A loop re-reads context every tick. Without a `CLAUDE.md`, it re-derives the repo's
conventions each time (and gets them subtly wrong). `CLAUDE.md` is the cheap, stable
anchor: stack, toolchain, the green-gate command, code conventions, where things
live, and git etiquette. Write it once, every tick benefits.

## 2. The agent can self-verify: `scripts/verify.sh` (the green-gate)

> "Make sure Claude has a way to self-verify its work end to end." - Boris, tip #5

`scripts/verify.sh` mirrors the CI quality + build jobs (prisma generate, lint,
typecheck, unit tests, production build) as **one command** that exits 0 or non-zero.
`--full` adds integration + E2E (needs the test Postgres). This is the feedback
inside the loop - the single most important piece. A loop that cannot check itself
is a machine for generating confident mistakes.

```bash
bash scripts/verify.sh
```

## 3. The agent does not stop to ask: permissions (`.claude/settings.json`)

> "Use auto mode for permissions so Claude doesn't ask for approval." - Boris, tip #1

Two files, on purpose:

- **`.claude/settings.json`** (committed, team-wide): `defaultMode: acceptEdits`, an
  `allow` list scoped to this repo's real commands (npm scripts, prisma, git
  read+write, `gh pr/issue`, safe read bash, the green-gate), and a `deny` list that
  blocks destructive ops (`rm -rf`, force-push, `git reset --hard`). This is the
  reproducible, publishable part.
- **`.claude/settings.local.json`** (gitignored, machine-specific): just `env.PATH`,
  prepending the nvm node bin so `npm`/`npx` resolve in a non-interactive shell.
  Never commit a path with your home directory in it.

The autonomy spectrum:

| Level | Effect | Risk |
| --- | --- | --- |
| allow-list | known commands never prompt; novel ones still do | low (scoped) |
| `acceptEdits` | file edits auto-apply | low |
| `bypassPermissions` | nothing ever prompts (Boris's "auto mode") | high |

We run **allow-list + acceptEdits** while watching locally, and flip to
`bypassPermissions` only for the unattended cloud phase (see `02`).

> Settings changes load at session start. After editing them, restart the session
> (or open `/hooks` once) so the new permissions and PATH take effect.

## 4. The reusable unit: a skill, not a prompt

> "The reusable unit inside the loop is a skill, not a prompt." - the closing lesson

`.claude/skills/implement-issue/SKILL.md` encodes the Issue -> PR procedure once:
branch, implement to conventions, add tests, pass the green-gate (max 3 fix
attempts), commit, push, open a PR that closes the issue, never merge. The loop just
calls this skill; the skill carries the discipline. That is what makes the system
compound instead of burn money.

## Result

With these four in place, the loop body is tiny: "pick the next issue, run
`implement-issue`, stop when done." Everything hard is already a named, tested asset.
Next: `02-issue-to-pr-loop.md`.
