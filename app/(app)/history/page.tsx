import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Calendar, ChevronRight, History as HistoryIcon } from 'lucide-react';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { applyBodyweight, totalVolume } from '@/lib/stats';
import { formatWeight } from '@/lib/units';
import { formatDistance, formatDuration } from '@/lib/cardio';
import { HistoryFilters } from '@/components/history/history-filters';
import { getExerciseDisplayName } from '@/i18n/exercise-names';

interface SearchParams {
  programId?: string;
  month?: string; // YYYY-MM
}

export default async function HistoryPage(props: { searchParams: Promise<SearchParams> }) {
  const t = await getTranslations('history');
  const common = await getTranslations('common');
  const locale = await getLocale();
  const format = await getFormatter();
  const searchParams = await props.searchParams;
  const session = await requireSession();

  const hasActiveFilters = Boolean(searchParams.programId || searchParams.month);

  // Filters: program and month (YYYY-MM).
  const programFilter = searchParams.programId ? { programId: searchParams.programId } : {};

  let dateFilter: { startedAt?: { gte: Date; lt: Date } } = {};
  if (searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month)) {
    const [yStr, mStr] = searchParams.month.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    dateFilter = {
      startedAt: {
        gte: new Date(Date.UTC(y, m - 1, 1)),
        lt: new Date(Date.UTC(y, m, 1)),
      },
    };
  }

  const [sessions, programs, user] = await Promise.all([
    db.session.findMany({
      where: {
        userId: session.userId,
        finishedAt: { not: null },
        ...programFilter,
        ...dateFilter,
      },
      orderBy: { startedAt: 'desc' },
      include: {
        workout: { select: { name: true } },
        program: { select: { name: true } },
        sets: {
          select: {
            weight: true,
            reps: true,
            isWarmup: true,
            durationSec: true,
            distanceM: true,
            avgHr: true,
            exercise: { select: { usesBodyweight: true, name: true, category: true } },
          },
        },
      },
      take: 100,
    }),
    db.program.findMany({
      where: { userId: session.userId },
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      select: { id: true, name: true },
    }),
    db.user.findUnique({
      where: { id: session.userId },
      select: { bodyweight: true, unit: true },
    }),
  ]);
  const unit = user?.unit ?? 'KG';

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <HistoryIcon className="size-6" />
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        </div>

        <HistoryFilters
          programs={programs}
          selectedProgramId={searchParams.programId}
          selectedMonth={searchParams.month}
        />

        {sessions.length === 0 ? (
          hasActiveFilters ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {t('noFiltered')}
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={HistoryIcon}
              title={t('emptyTitle')}
              description={t('emptyDescription')}
              action={{ label: t('firstSession'), href: '/session/new' }}
            />
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => {
              const enrichedSets = applyBodyweight(
                s.sets.map((set) => ({
                  weight: set.weight,
                  reps: set.reps,
                  isWarmup: set.isWarmup,
                  durationSec: set.durationSec,
                  usesBodyweight: set.exercise.usesBodyweight,
                })),
                user?.bodyweight,
              );
              const volume = totalVolume(enrichedSets);
              const working = s.sets.filter((set) => !set.isWarmup);
              const workingSets = working.length;
              const durationMin =
                s.finishedAt && s.startedAt
                  ? Math.round((s.finishedAt.getTime() - s.startedAt.getTime()) / 60000)
                  : null;
              // A cardio/imported activity (issue #133+): every working set is a
              // CARDIO set. Render it as the activity (name, distance, duration,
              // HR) instead of "Free session - 0 kg vol", which reads as empty.
              const cardioSets = working.filter(
                (set) => set.exercise.category === 'CARDIO' && set.durationSec != null,
              );
              const isCardio = workingSets > 0 && cardioSets.length === workingSets;
              const cardioName = cardioSets[0]?.exercise.name
                ? getExerciseDisplayName(cardioSets[0].exercise.name, locale)
                : t('cardio');
              const cardioDistance = cardioSets.reduce((sum, set) => sum + (set.distanceM ?? 0), 0);
              const cardioDurationSec = cardioSets.reduce(
                (sum, set) => sum + (set.durationSec ?? 0),
                0,
              );
              const cardioAvgHr = cardioSets.find((set) => set.avgHr != null)?.avgHr ?? null;
              return (
                <li key={s.id}>
                  <Link href={`/history/${s.id}`} className="block">
                    <Card className="transition-colors hover:bg-accent/40">
                      <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="size-3" />
                            <span>
                              {format.dateTime(s.startedAt, {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-base font-medium">
                            {s.workout?.name ?? (isCardio ? cardioName : t('freeSession'))}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                            {s.program && <Badge variant="secondary">{s.program.name}</Badge>}
                            {isCardio ? (
                              <>
                                {cardioDistance > 0 && (
                                  <Badge variant="outline">{formatDistance(cardioDistance)}</Badge>
                                )}
                                <Badge variant="outline">
                                  {formatDuration(cardioDurationSec || (durationMin ?? 0) * 60)}
                                </Badge>
                                {cardioAvgHr != null && (
                                  <Badge variant="outline">{cardioAvgHr} bpm</Badge>
                                )}
                              </>
                            ) : (
                              <>
                                <Badge variant="outline">
                                  {common('counts.sets', { count: workingSets })}
                                </Badge>
                                <Badge variant="outline">
                                  {t('volumeShort', {
                                    weight: formatWeight(volume, unit, {
                                      decimals: 0,
                                      locale,
                                    }),
                                  })}
                                </Badge>
                                {durationMin != null && (
                                  <Badge variant="outline">
                                    {t('minutes', { count: durationMin })}
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
