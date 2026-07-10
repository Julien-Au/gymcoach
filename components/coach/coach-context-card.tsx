'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CoachContextSummary } from '@/lib/coach-context';
import { useExerciseName } from '@/components/shared/use-exercise-name';

interface Props {
  summary: CoachContextSummary;
}

// "What your coach sees" (issue #154, display-only): a collapsed-by-default
// card that renders the same payload sections the AI debrief receives, so the
// user can verify at a glance that the coach knows their training. The summary
// is derived server-side from buildCoachPayload via summarizeCoachPayload -
// no derivation is duplicated here.
export function CoachContextCard({ summary }: Props) {
  const t = useTranslations('coach.context');
  const exerciseName = useExerciseName();
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
          <h2 className="text-base font-semibold">{t('title')}</h2>
        </button>
        {!open && <p className="pl-6 text-xs text-muted-foreground">{t('teaser')}</p>}
      </CardHeader>
      {open && (
        <CardContent className="flex flex-col gap-4 text-sm">
          <Section title={t('history')}>
            {summary.weeksOfHistory > 0 ? (
              <p>
                {t('historySummary', {
                  weeks: summary.weeksOfHistory,
                  exercises: summary.exercisesTracked,
                })}
              </p>
            ) : (
              <p className="text-muted-foreground">{t('noHistory')}</p>
            )}
          </Section>

          <Section title={t('goals')}>
            {summary.goals.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {summary.goals.map((g) => (
                  <li key={`${g.exerciseName}-${g.targetWeight}-${g.targetReps}`}>
                    {exerciseName(g.exerciseName)}: {g.targetWeight} kg x {g.targetReps}{' '}
                    {g.achieved ? (
                      <Badge variant="secondary">{t('achieved')}</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {t('goalProgress', { percent: g.progressPct })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t('noGoals')}</p>
            )}
          </Section>

          <Section title={t('fatigue')}>
            {summary.stalledExercises.length > 0 ? (
              <p>
                {t('stalled', {
                  names: summary.stalledExercises.map(exerciseName).join(', '),
                })}
              </p>
            ) : (
              <p className="text-muted-foreground">{t('noStalled')}</p>
            )}
            {summary.deloadActive ? (
              <p>{t('deloadActive')}</p>
            ) : summary.deloadRecommended ? (
              <p>
                {t('deloadRecommended', {
                  reasons:
                    summary.deloadReasons.length > 0 ? summary.deloadReasons.join('; ') : 'none',
                })}
              </p>
            ) : (
              <p className="text-muted-foreground">{t('noDeload')}</p>
            )}
          </Section>

          <Section title={t('conditioning')}>
            <p>
              {t('conditioningSummary', {
                minutes: summary.conditioning.currentMinutes,
                km: summary.conditioning.currentKm > 0 ? summary.conditioning.currentKm : 'none',
                sessions: summary.conditioning.currentSessions,
                target: summary.conditioning.weeklyTargetMin,
              })}
            </p>
          </Section>

          <Section title={t('readiness')}>
            {summary.readiness ? (
              <p>
                {t('readinessSummary', {
                  when:
                    summary.readiness.daysAgo === 0
                      ? t('today')
                      : t('daysAgo', { days: summary.readiness.daysAgo }),
                  readiness: summary.readiness.readiness,
                  sleep: summary.readiness.sleepQuality,
                })}
              </p>
            ) : (
              <p className="text-muted-foreground">{t('noReadiness')}</p>
            )}
          </Section>

          <p className="border-t pt-3 text-xs text-muted-foreground">{t('privacy')}</p>
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
