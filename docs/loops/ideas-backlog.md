# Ideas backlog

Append-only log of feature ideas surfaced by the ideation loop (see the triage
loop, `03-triage-loop.md`). One line per idea:

`<status> - <title> (issue #N, YYYY-MM-DD) - <note>`

Status is `proposed` when filed, and is not edited in place; the issue and its PR
carry the live state. This file is the loop's memory of what it has already
suggested, so it does not re-propose the same idea.

## Log

proposed - feat: warm-up set calculator from the working weight (in-session) (issue #69, 2026-06-09) - pure lib/warmup.ts + display-only dialog modeled on the plate calculator; reuses the existing isWarmup flag, fully additive.
proposed - feat: detect personal records (heaviest set + best e1RM) and surface a badge (issue #70, 2026-06-09) - pure lib/records.ts on top of existing estimate1RM/best1RM; PRs derived on read, no records table (that would need a migration).
proposed - feat: training consistency calendar (sessions-per-week + current streak) on the progress page (issue #71, 2026-06-09) - read-only derivation from finished sessions reusing isoWeekKey/isoWeekStart; respects weeklyFrequency target, no new model.
