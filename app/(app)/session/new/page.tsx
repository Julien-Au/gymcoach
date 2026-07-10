import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StartWorkoutButton } from '@/components/session/start-workout-button';
import { ReadinessCheckin } from '@/components/session/readiness-checkin';

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export default async function NewSessionPage() {
  const t = await getTranslations('session');
  const common = await getTranslations('common');
  const session = await requireSession();
  const activeProgram = await db.program.findFirst({
    where: { userId: session.userId, isActive: true },
    include: {
      workouts: {
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { exercises: true } },
        },
      },
    },
  });

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link href="/">
            <ChevronLeft className="size-4" />
            <span className="ml-1">{common('actions.back')}</span>
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('startTitle')}</h1>
          {activeProgram ? (
            <p className="text-sm text-muted-foreground">
              {t('activeProgram', { name: activeProgram.name })}
            </p>
          ) : null}
        </div>

        {!activeProgram ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('noActiveProgram')}</CardTitle>
              <CardDescription>
                {t('noActiveProgramDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/programs">{t('viewPrograms')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : activeProgram.workouts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('noSession')}</CardTitle>
              <CardDescription>
                {t('noSessionDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/programs/${activeProgram.id}`}>{t('configureProgram')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <ReadinessCheckin />
            <ul className="flex flex-col gap-3">
            {activeProgram.workouts.map((w) => {
              const dayKey = w.dayOfWeek != null ? DAY_KEYS[w.dayOfWeek - 1] : null;
              const day = dayKey ? common(`days.${dayKey}`) : null;
              return (
                <li key={w.id}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-base">{w.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {common('counts.exercises', { count: w._count.exercises })}
                          </CardDescription>
                        </div>
                        {day && <Badge variant="secondary">{day}</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <StartWorkoutButton
                        workoutId={w.id}
                        disabled={w._count.exercises === 0}
                      />
                    </CardContent>
                  </Card>
                </li>
              );
            })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
