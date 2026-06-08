import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, Dumbbell } from 'lucide-react';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MUSCLE_GROUP_LABELS } from '@/lib/schemas/exercise';
import { applyBodyweight, best1RM, totalVolume } from '@/lib/stats';
import { formatWeight } from '@/lib/units';
import { DeleteSessionButton } from '@/components/history/delete-session-button';

interface Params {
  params: { id: string };
}

export default async function HistorySessionPage({ params }: Params) {
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
      usesBodyweight: s.exercise.usesBodyweight,
    })),
    bodyweight,
  );
  const volume = totalVolume(enrichedAllSets);
  const workingSetCount = session.sets.filter((s) => !s.isWarmup).length;
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
              <span className="ml-1">History</span>
            </Link>
          </Button>
          <DeleteSessionButton
            sessionId={session.id}
            workoutName={session.workout?.name ?? null}
            startedAt={session.startedAt}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {session.workout?.name ?? 'Free session'}
            </h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {session.program && (
                <Badge variant="secondary">{session.program.name}</Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <Calendar className="size-3" />
                {new Intl.DateTimeFormat('en-US', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(session.startedAt)}
              </Badge>
              {durationMin != null && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="size-3" />
                  {durationMin} min
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pt-0 text-sm sm:grid-cols-3">
            <Stat label="Sets" value={String(workingSetCount)} />
            <Stat label="Exercises" value={String(setsByExercise.size)} />
            <Stat
              label="Total volume"
              value={formatWeight(volume, unit, { decimals: 0 })}
            />
          </CardContent>
        </Card>

        {session.notes && (
          <Card>
            <CardContent className="py-4 text-sm">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Notes
              </p>
              <p className="whitespace-pre-line">{session.notes}</p>
            </CardContent>
          </Card>
        )}

        {exerciseOrder.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No set recorded.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {exerciseOrder.map((exerciseId) => {
              const entry = setsByExercise.get(exerciseId);
              if (!entry) return null;
              const enrichedExoSets = applyBodyweight(
                entry.sets.map((s) => ({
                  weight: s.weight,
                  reps: s.reps,
                  isWarmup: s.isWarmup,
                  usesBodyweight: entry.exercise.usesBodyweight,
                })),
                bodyweight,
              );
              const exoVolume = totalVolume(enrichedExoSets);
              const e1rm = best1RM(enrichedExoSets);
              return (
                <li key={exerciseId}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-base font-semibold">{entry.exercise.name}</h2>
                        <Badge variant="secondary" className="text-xs">
                          {MUSCLE_GROUP_LABELS[entry.exercise.muscleGroup]}
                        </Badge>
                      </div>
                      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                        <span>
                          Volume:{' '}
                          {formatWeight(exoVolume, unit, {
                            decimals: 0,
                            group: false,
                          })}
                        </span>
                        {e1rm > 0 && (
                          <span>
                            Est. 1RM:{' '}
                            {formatWeight(e1rm, unit, {
                              decimals: 1,
                              fixed: true,
                              group: false,
                            })}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="py-1.5 font-medium">#</th>
                            <th className="py-1.5 font-medium">Load</th>
                            <th className="py-1.5 font-medium">Reps</th>
                            <th className="py-1.5 font-medium">RIR</th>
                            <th className="py-1.5 font-medium">Type</th>
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
                                      })}
                                      <span className="ml-1 text-xs text-muted-foreground">
                                        ({s.weight >= 0 ? '+' : ''}
                                        {formatWeight(s.weight, unit, {
                                          decimals: 2,
                                          withUnit: false,
                                          group: false,
                                        })}{' '}
                                        ext)
                                      </span>
                                    </span>
                                  ) : effective === 0 ? (
                                    'BW'
                                  ) : (
                                    formatWeight(effective, unit, {
                                      decimals: 2,
                                      group: false,
                                    })
                                  )}
                                </td>
                                <td className="py-1.5">{s.reps}</td>
                                <td className="py-1.5">{s.rir ?? '-'}</td>
                                <td className="py-1.5 text-xs">
                                  {s.isWarmup
                                    ? 'Warmup'
                                    : s.isDropSet
                                      ? 'Drop set'
                                      : 'Working'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {entry.sets.some((s) => s.notes) && (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {entry.sets
                            .filter((s) => s.notes)
                            .map((s) => (
                              <p key={s.id}>
                                <span className="font-medium">Set {s.setNumber}: </span>
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
