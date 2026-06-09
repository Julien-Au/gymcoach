import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StartWorkoutButton } from '@/components/session/start-workout-button';
import { ReadinessCheckin } from '@/components/session/readiness-checkin';
import { DAY_LABELS } from '@/lib/schemas/workout';

export default async function NewSessionPage() {
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
            <span className="ml-1">Back</span>
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Start a session</h1>
          {activeProgram ? (
            <p className="text-sm text-muted-foreground">
              Active program: <span className="font-medium">{activeProgram.name}</span>
            </p>
          ) : null}
        </div>

        {!activeProgram ? (
          <Card>
            <CardHeader>
              <CardTitle>No active program</CardTitle>
              <CardDescription>
                Activate a program so you can start a session.
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
              <CardTitle>No session in this program</CardTitle>
              <CardDescription>
                Add at least one session with exercises before starting.
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
            <ReadinessCheckin />
            <ul className="flex flex-col gap-3">
            {activeProgram.workouts.map((w) => {
              const day = w.dayOfWeek != null ? DAY_LABELS[w.dayOfWeek - 1] : null;
              return (
                <li key={w.id}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-base">{w.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {w._count.exercises} exercise{w._count.exercises > 1 ? 's' : ''}
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
