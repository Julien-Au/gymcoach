import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Dumbbell, History, TrendingUp } from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import {
  equipmentTypeMessageKeys,
  exerciseCategoryMessageKeys,
  muscleGroupMessageKeys,
} from '@/i18n/enum-keys';
import { estimate1RM } from '@/lib/stats';
import { formatWeight } from '@/lib/units';
import { ExerciseMediaDialog } from '@/components/exercises/exercise-media-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { safeSessionReturnPath } from '@/lib/session-exercise-navigation';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function ExerciseDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { returnTo: requestedReturnTo } = await searchParams;
  const auth = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations('exercises.detail');
  const exerciseT = await getTranslations('exercises');
  const format = await getFormatter();

  const [exercise, user] = await Promise.all([
    db.exercise.findFirst({
      where: { id, userId: auth.userId },
      include: {
        sets: {
          where: { isWarmup: false, session: { userId: auth.userId } },
          orderBy: { completedAt: 'desc' },
          take: 100,
          include: {
            session: { select: { id: true, startedAt: true } },
          },
        },
      },
    }),
    db.user.findUnique({ where: { id: auth.userId }, select: { unit: true } }),
  ]);

  if (!exercise) notFound();
  const returnTo = safeSessionReturnPath(requestedReturnTo);
  const displayName = getExerciseDisplayName(exercise.name, locale);
  const unit = user?.unit ?? 'KG';
  const sessions = new Map<string, { id: string; startedAt: Date; sets: typeof exercise.sets }>();
  for (const set of exercise.sets) {
    const existing = sessions.get(set.session.id);
    if (existing) existing.sets.push(set);
    else
      sessions.set(set.session.id, {
        id: set.session.id,
        startedAt: set.session.startedAt,
        sets: [set],
      });
  }
  const recentSessions = [...sessions.values()]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 12);

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link href={returnTo ?? '/exercises'}>
            <ChevronLeft className="size-4" />
            <span className="ml-1">{t(returnTo ? 'backToSession' : 'back')}</span>
          </Link>
        </Button>

        <header className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              {displayName !== exercise.name && (
                <p className="text-sm text-muted-foreground">{exercise.name}</p>
              )}
            </div>
            <ExerciseMediaDialog
              exerciseName={exercise.name}
              displayName={displayName}
              equipmentType={exercise.equipmentType}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>
              {exerciseT(`muscleGroups.${muscleGroupMessageKeys[exercise.muscleGroup]}`)}
            </Badge>
            <Badge variant="secondary">
              {exerciseT(`categories.${exerciseCategoryMessageKeys[exercise.category]}`)}
            </Badge>
            <Badge variant="outline">
              {exerciseT(`equipmentTypes.${equipmentTypeMessageKeys[exercise.equipmentType]}`)}
            </Badge>
          </div>
        </header>

        <section className="space-y-3 border-t border-border pt-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Dumbbell className="size-4" />
            {t('information')}
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t('muscle')}</dt>
              <dd className="font-medium">
                {exerciseT(`muscleGroups.${muscleGroupMessageKeys[exercise.muscleGroup]}`)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('equipment')}</dt>
              <dd className="font-medium">
                {exerciseT(`equipmentTypes.${equipmentTypeMessageKeys[exercise.equipmentType]}`)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('defaultRest')}</dt>
              <dd className="font-medium">
                {exercise.defaultRestSec} {t('seconds')}
              </dd>
            </div>
          </dl>
          {exercise.notes && (
            <p className="whitespace-pre-line rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
              {exercise.notes}
            </p>
          )}
        </section>

        <section className="space-y-3 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <History className="size-4" />
              {t('history')}
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link href={`/progress?exerciseId=${exercise.id}`}>
                <TrendingUp className="size-4" />
                <span className="ml-2">{t('openChart')}</span>
              </Link>
            </Button>
          </div>

          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noHistory')}</p>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/history/${session.id}`}
                  className="block px-3 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {format.dateTime(session.startedAt, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">{t('openSession')}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs tabular-nums text-muted-foreground">
                    <span>#</span>
                    <span>{unit}</span>
                    <span>REPS</span>
                    <span>1RM</span>
                    {session.sets
                      .sort((a, b) => a.setNumber - b.setNumber)
                      .map((set, index) => (
                        <div key={set.id} className="contents text-foreground">
                          <span>{index + 1}</span>
                          <span>
                            {formatWeight(set.weight, unit, { decimals: 2, group: false, locale })}
                          </span>
                          <span>{set.reps}</span>
                          <span>
                            {formatWeight(estimate1RM(set.weight, set.reps), unit, {
                              decimals: 1,
                              group: false,
                              locale,
                            })}
                          </span>
                        </div>
                      ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
