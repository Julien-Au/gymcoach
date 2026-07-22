import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft, Calendar, Clock, Download, Dumbbell } from 'lucide-react';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import { applyBodyweight, best1RM, totalVolume } from '@/lib/stats';
import {
  formatCardioSet,
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
  sumCardioWorkingSets,
} from '@/lib/cardio';
import { formatWeight } from '@/lib/units';
import { DeleteSessionButton } from '@/components/history/delete-session-button';
import { ActivityTrackChart } from '@/components/history/activity-track-chart';
import { TrackDecoupling } from '@/components/history/track-decoupling';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { getTrainingDisplayName } from '@/i18n/training-names';

interface Params {
  params: Promise<{ id: string }>;
}

export default async function HistorySessionPage(props: Params) {
  const t = await getTranslations('history');
  const detail = await getTranslations('history.detail');
  const exerciseT = await getTranslations('exercises');
  const locale = await getLocale();
  const format = await getFormatter();
  const params = await props.params;
  const auth = await requireSession();

  const [session, user] = await Promise.all([
    db.session.findUnique({
      where: { id: params.id },
      include: {
        workout: { select: { name: true } },
        program: { select: { name: true } },
        sets: {
          orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }],
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                muscleGroup: true,
                category: true,
                usesBodyweight: true,
              },
            },
          },
        },
      },
    }),
    db.user.findUnique({
      where: { id: auth.userId },
      select: { bodyweight: true, unit: true },
    }),
  ]);

  if (!session || session.userId !== auth.userId) {
    notFound();
  }
  const bodyweight = user?.bodyweight ?? null;
  const unit = user?.unit ?? 'KG';

  // Group sets by exercise (keeping the order of the first set per exercise).
  const exerciseOrder: string[] = [];
  const setsByExercise = new Map<
    string,
    { exercise: (typeof session.sets)[number]['exercise']; sets: typeof session.sets }
  >();
  for (const s of session.sets) {
    let entry = setsByExercise.get(s.exerciseId);
    if (!entry) {
      entry = { exercise: s.exercise, sets: [] };
      setsByExercise.set(s.exerciseId, entry);
      exerciseOrder.push(s.exerciseId);
    }
    entry.sets.push(s);
  }

  // For tonnage, we enrich the sets with their usesBodyweight + the user's
  // bodyweight. Exercises that are not flagged stay unchanged.
  const enrichedAllSets = applyBodyweight(
    session.sets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      isWarmup: s.isWarmup,
      durationSec: s.durationSec,
      usesBodyweight: s.exercise.usesBodyweight,
    })),
    bodyweight,
  );
  const volume = totalVolume(enrichedAllSets);
  const workingSetCount = session.sets.filter((s) => !s.isWarmup).length;
  // TCX export (issue #175) is offered only for a FINISHED session that has
  // cardio sets; the route 400s on a cardio-less session, and an in-progress
  // session (reachable only by direct URL here) is not a complete export.
  const hasCardio = session.finishedAt != null && session.sets.some((s) => s.durationSec != null);
  const durationMin =
    session.finishedAt && session.startedAt
      ? Math.round((session.finishedAt.getTime() - session.startedAt.getTime()) / 60000)
      : null;

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/history">
              <ArrowLeft className="size-4" />
              <span className="ml-1">{t('title')}</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {hasCardio && (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/cardio/tcx?sessionId=${session.id}`} download>
                  <Download className="size-4" />
                  <span className="ml-1">{detail('downloadTcx')}</span>
                </a>
              </Button>
            )}
            <DeleteSessionButton
              sessionId={session.id}
              workoutName={
                session.workout?.name ? getTrainingDisplayName(session.workout.name, locale) : null
              }
              startedAt={session.startedAt}
            />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {session.workout?.name
                ? getTrainingDisplayName(session.workout.name, locale)
                : t('freeSession')}
            </h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {session.program && (
                <Badge variant="secondary">
                  {getTrainingDisplayName(session.program.name, locale)}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <Calendar className="size-3" />
                {format.dateTime(session.startedAt, {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Badge>
              {durationMin != null && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="size-3" />
                  {t('minutes', { count: durationMin })}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pt-0 text-sm sm:grid-cols-3">
            <Stat label={detail('sets')} value={String(workingSetCount)} />
            <Stat label={detail('exercises')} value={String(setsByExercise.size)} />
            <Stat
              label={detail('totalVolume')}
              value={formatWeight(volume, unit, { decimals: 0, locale })}
            />
          </CardContent>
        </Card>

        {session.notes && (
          <Card>
            <CardContent className="py-4 text-sm">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                {detail('notes')}
              </p>
              <p className="whitespace-pre-line">{session.notes}</p>
            </CardContent>
          </Card>
        )}

        {exerciseOrder.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {detail('noSets')}
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {exerciseOrder.map((exerciseId) => {
              const entry = setsByExercise.get(exerciseId);
              if (!entry) return null;
              const isCardio = entry.exercise.category === 'CARDIO';
              const enrichedExoSets = applyBodyweight(
                entry.sets.map((s) => ({
                  weight: s.weight,
                  reps: s.reps,
                  isWarmup: s.isWarmup,
                  durationSec: s.durationSec,
                  usesBodyweight: entry.exercise.usesBodyweight,
                })),
                bodyweight,
              );
              const exoVolume = totalVolume(enrichedExoSets);
              const e1rm = best1RM(enrichedExoSets);
              // Cardio recap (issue #133): totals across the WORKING sets, with
              // derived pace and speed (issue #177) appended when a distance was
              // covered (omitted for duration-only cardio). Warmups are excluded
              // (issue #183), matching the working-set convention used elsewhere.
              const { durationSec: cardioDurationTotal, distanceM: cardioDistanceTotal } =
                sumCardioWorkingSets(entry.sets);
              const cardioTotal = isCardio
                ? [
                    formatCardioSet(cardioDurationTotal, cardioDistanceTotal),
                    formatPace(cardioDurationTotal, cardioDistanceTotal, unit),
                    formatSpeed(cardioDurationTotal, cardioDistanceTotal, unit),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : null;
              return (
                <li key={exerciseId}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-base font-semibold">
                          {getExerciseDisplayName(entry.exercise.name, locale)}
                        </h2>
                        <Badge variant="secondary" className="text-xs">
                          {exerciseT(
                            `muscleGroups.${muscleGroupMessageKeys[entry.exercise.muscleGroup]}`,
                          )}
                        </Badge>
                      </div>
                      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                        {cardioTotal ? (
                          <span>{detail('total', { value: cardioTotal })}</span>
                        ) : (
                          <span>
                            {detail('volume', {
                              value: formatWeight(exoVolume, unit, {
                                decimals: 0,
                                group: false,
                                locale,
                              }),
                            })}
                          </span>
                        )}
                        {e1rm > 0 && (
                          <span>
                            {detail('oneRm', {
                              value: formatWeight(e1rm, unit, {
                                decimals: 1,
                                fixed: true,
                                group: false,
                                locale,
                              }),
                            })}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {isCardio ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                              <th className="py-1.5 font-medium">#</th>
                              <th className="py-1.5 font-medium">{detail('duration')}</th>
                              <th className="py-1.5 font-medium">{detail('distance')}</th>
                              <th className="py-1.5 font-medium">{detail('pace')}</th>
                              <th className="py-1.5 font-medium">{detail('avgHr')}</th>
                              <th className="py-1.5 font-medium">{detail('maxHr')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.sets.map((s) => {
                              const pace =
                                s.durationSec != null
                                  ? formatPace(s.durationSec, s.distanceM, unit)
                                  : null;
                              return (
                                <tr key={s.id} className="border-b border-border/40">
                                  <td className="py-1.5">{s.setNumber}</td>
                                  <td className="py-1.5">
                                    {s.durationSec != null ? formatDuration(s.durationSec) : '-'}
                                  </td>
                                  <td className="py-1.5">
                                    {s.distanceM != null && s.distanceM > 0
                                      ? formatDistance(s.distanceM)
                                      : '-'}
                                  </td>
                                  <td className="py-1.5">{pace ?? '-'}</td>
                                  <td className="py-1.5">
                                    {s.avgHr != null ? `${s.avgHr} bpm` : '-'}
                                  </td>
                                  <td className="py-1.5">
                                    {s.maxHr != null ? `${s.maxHr} bpm` : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : null}
                      {isCardio &&
                        entry.sets.map((s) => {
                          if (!Array.isArray(s.track) || s.track.length === 0) return null;
                          const track = s.track as { t: number; d?: number; hr?: number }[];
                          return (
                            <div key={`track-${s.id}`}>
                              <ActivityTrackChart track={track} />
                              <TrackDecoupling track={track} />
                            </div>
                          );
                        })}
                      {!isCardio && (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                              <th className="py-1.5 font-medium">#</th>
                              <th className="py-1.5 font-medium">{detail('load')}</th>
                              <th className="py-1.5 font-medium">{detail('reps')}</th>
                              <th className="py-1.5 font-medium">RIR</th>
                              <th className="py-1.5 font-medium">{detail('type')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.sets.map((s) => {
                              const isBw = entry.exercise.usesBodyweight && bodyweight;
                              const effective = isBw ? bodyweight + s.weight : s.weight;
                              return (
                                <tr
                                  key={s.id}
                                  className={
                                    s.isWarmup
                                      ? 'text-muted-foreground'
                                      : 'border-b border-border/40'
                                  }
                                >
                                  <td className="py-1.5">{s.setNumber}</td>
                                  <td className="py-1.5">
                                    {isBw ? (
                                      <span>
                                        {formatWeight(effective, unit, {
                                          decimals: 2,
                                          group: false,
                                          locale,
                                        })}
                                        <span className="ml-1 text-xs text-muted-foreground">
                                          ({s.weight >= 0 ? '+' : ''}
                                          {formatWeight(s.weight, unit, {
                                            decimals: 2,
                                            withUnit: false,
                                            group: false,
                                            locale,
                                          })}{' '}
                                          {detail('external')})
                                        </span>
                                      </span>
                                    ) : effective === 0 ? (
                                      detail('bodyweight')
                                    ) : (
                                      formatWeight(effective, unit, {
                                        decimals: 2,
                                        group: false,
                                        locale,
                                      })
                                    )}
                                  </td>
                                  <td className="py-1.5">{s.reps}</td>
                                  <td className="py-1.5">{s.rir ?? '-'}</td>
                                  <td className="py-1.5 text-xs">
                                    {s.isWarmup
                                      ? detail('warmup')
                                      : s.isDropSet
                                        ? detail('dropSet')
                                        : detail('working')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                      {entry.sets.some((s) => s.notes) && (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {entry.sets
                            .filter((s) => s.notes)
                            .map((s) => (
                              <p key={s.id}>
                                <span className="font-medium">
                                  {detail('setNote', { number: s.setNumber })}{' '}
                                </span>
                                {s.notes}
                              </p>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Dumbbell className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}
