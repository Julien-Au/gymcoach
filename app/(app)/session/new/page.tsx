import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StartWorkoutButton } from '@/components/session/start-workout-button';
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
            <span className="ml-1">Retour</span>
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Démarrer une séance</h1>
          {activeProgram ? (
            <p className="text-sm text-muted-foreground">
              Programme actif : <span className="font-medium">{activeProgram.name}</span>
            </p>
          ) : null}
        </div>

        {!activeProgram ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucun programme actif</CardTitle>
              <CardDescription>
                Active un programme pour pouvoir démarrer une séance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/programs">Voir les programmes</Link>
              </Button>
            </CardContent>
          </Card>
        ) : activeProgram.workouts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucune séance dans ce programme</CardTitle>
              <CardDescription>
                Ajoute au moins une séance avec des exercices avant de démarrer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/programs/${activeProgram.id}`}>Configurer le programme</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
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
                            {w._count.exercises} exercice{w._count.exercises > 1 ? 's' : ''}
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
        )}
      </div>
    </main>
  );
}
