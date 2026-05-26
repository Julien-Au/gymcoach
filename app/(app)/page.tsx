import Link from 'next/link';
import { Dumbbell, Play, AlertCircle } from 'lucide-react';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DAY_LABELS } from '@/lib/schemas/workout';

export default async function DashboardPage() {
  const session = await requireSession();

  // Look for an unfinished session to offer resuming it.
  const inProgressSession = await db.session.findFirst({
    where: { userId: session.userId, finishedAt: null },
    orderBy: { startedAt: 'desc' },
    include: { workout: { select: { name: true } } },
  });

  const activeProgram = await db.program.findFirst({
    where: { userId: session.userId, isActive: true },
    include: {
      workouts: {
        orderBy: { order: 'asc' },
        include: { _count: { select: { exercises: true } } },
      },
    },
  });

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Dumbbell className="size-8" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GymCoach</h1>
            <p className="text-xs text-muted-foreground">{session.email}</p>
          </div>
        </div>

        {inProgressSession ? (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Active session</CardTitle>
              <CardDescription>
                {inProgressSession.workout?.name ?? 'Session'} started on{' '}
                {new Intl.DateTimeFormat('en-US', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(inProgressSession.startedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="min-h-tap w-full text-base">
                <Link href={`/session/${inProgressSession.id}`}>Resume session</Link>
              </Button>
            </CardContent>
          </Card>
        ) : !activeProgram ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No active program</CardTitle>
              <CardDescription>
                Activate a program to start a session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/programs">View programs</Link>
              </Button>
            </CardContent>
          </Card>
        ) : activeProgram.workouts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Empty program</CardTitle>
              <CardDescription>
                {activeProgram.name} has no session configured.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/programs/${activeProgram.id}`}>Configure program</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Start a session</CardTitle>
                <CardDescription>
                  Active program: {activeProgram.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="min-h-tap w-full text-base">
                  <Link href="/session/new">
                    <Play className="size-5" />
                    <span className="ml-2">Choose a session</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Program sessions
              </h2>
              <ul className="flex flex-col gap-2">
                {activeProgram.workouts.map((w) => {
                  const day = w.dayOfWeek != null ? DAY_LABELS[w.dayOfWeek - 1] : null;
                  const empty = w._count.exercises === 0;
                  return (
                    <li key={w.id}>
                      <Card>
                        <CardContent className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{w.name}</p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {day && <Badge variant="secondary">{day}</Badge>}
                              <span>
                                {w._count.exercises} exercise{w._count.exercises > 1 ? 's' : ''}
                              </span>
                              {empty && (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <AlertCircle className="size-3" />
                                  empty
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
