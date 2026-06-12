'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CoachContextSummary } from '@/lib/coach-context';

interface Props {
  summary: CoachContextSummary;
}

// "What your coach sees" (issue #154, display-only): a collapsed-by-default
// card that renders the same payload sections the AI debrief receives, so the
// user can verify at a glance that the coach knows their training. The summary
// is derived server-side from buildCoachPayload via summarizeCoachPayload -
// no derivation is duplicated here.
export function CoachContextCard({ summary }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <Eye className="size-4 text-primary" />
          <h2 className="text-base font-semibold">What your coach sees</h2>
        </button>
        {!open && (
          <p className="pl-6 text-xs text-muted-foreground">
            The training context behind every debrief. Tap to expand.
          </p>
        )}
      </CardHeader>
      {open && (
        <CardContent className="flex flex-col gap-4 text-sm">
          <Section title="Training history">
            {summary.weeksOfHistory > 0 ? (
              <p>
                {summary.weeksOfHistory} week{summary.weeksOfHistory === 1 ? '' : 's'} of
                recent history across {summary.exercisesTracked} exercise
                {summary.exercisesTracked === 1 ? '' : 's'}.
              </p>
            ) : (
              <p className="text-muted-foreground">
                No logged sessions yet - the coach starts learning from your first workout.
              </p>
            )}
          </Section>

          <Section title="Goals">
            {summary.goals.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {summary.goals.map((g) => (
                  <li key={`${g.exerciseName}-${g.targetWeight}-${g.targetReps}`}>
                    {g.exerciseName}: {g.targetWeight} kg x {g.targetReps}{' '}
                    {g.achieved ? (
                      <Badge variant="secondary">achieved</Badge>
                    ) : (
                      <span className="text-muted-foreground">({g.progressPct}% there)</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No exercise goals set.</p>
            )}
          </Section>

          <Section title="Fatigue">
            {summary.stalledExercises.length > 0 ? (
              <p>Stalled lifts: {summary.stalledExercises.join(', ')}.</p>
            ) : (
              <p className="text-muted-foreground">No stalled lifts detected.</p>
            )}
            {summary.deloadActive ? (
              <p>A planned deload week is active.</p>
            ) : summary.deloadRecommended ? (
              <p>
                Deload recommended
                {summary.deloadReasons.length > 0
                  ? `: ${summary.deloadReasons.join('; ')}`
                  : ''}
                .
              </p>
            ) : (
              <p className="text-muted-foreground">No deload recommended.</p>
            )}
          </Section>

          <Section title="Conditioning">
            <p>
              This week: {summary.conditioning.currentMinutes} min
              {summary.conditioning.currentKm > 0
                ? ` · ${summary.conditioning.currentKm} km`
                : ''}
              {` · ${summary.conditioning.currentSessions} session${
                summary.conditioning.currentSessions === 1 ? '' : 's'
              }`}{' '}
              <span className="text-muted-foreground">
                (target {summary.conditioning.weeklyTargetMin} min/week)
              </span>
            </p>
          </Section>

          <Section title="Readiness">
            {summary.readiness ? (
              <p>
                Last check-in{' '}
                {summary.readiness.daysAgo === 0
                  ? 'today'
                  : `${summary.readiness.daysAgo} day${
                      summary.readiness.daysAgo === 1 ? '' : 's'
                    } ago`}
                : readiness {summary.readiness.readiness}/5, sleep{' '}
                {summary.readiness.sleepQuality}/5.
              </p>
            ) : (
              <p className="text-muted-foreground">No readiness check-in in the last 7 days.</p>
            )}
          </Section>

          <p className="border-t pt-3 text-xs text-muted-foreground">
            A compact summary like this, plus your recent set-by-set training logs, is what the AI receives - never your account data or anything outside your training history.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}
