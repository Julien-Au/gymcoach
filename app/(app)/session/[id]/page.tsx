import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { getLastPerformances, type LastPerformance } from '@/lib/last-performance';
import { SessionRunner, type SerializedLastPerformance } from '@/components/session/session-runner';

interface Props {
  params: { id: string };
}

export default async function SessionRunPage({ params }: Props) {
  const auth = await requireSession();

  const session = await db.session.findFirst({
    where: { id: params.id, userId: auth.userId },
    include: {
      workout: {
        include: {
          program: { select: { id: true, name: true } },
          exercises: {
            orderBy: { order: 'asc' },
            include: { exercise: true },
          },
        },
      },
      sets: { orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }] },
    },
  });

  if (!session) notFound();
  if (session.finishedAt) {
    // Session déjà clôturée : redirection vers l'accueil. Au LOT 8 on
    // pointera vers la page historique de la séance.
    redirect('/');
  }
  if (!session.workout) notFound();

  const exerciseIds = session.workout.exercises.map((pe) => pe.exerciseId);
  const lastPerformances = await getLastPerformances(auth.userId, exerciseIds, session.id);

  const lastPerfRecord: Record<string, SerializedLastPerformance> = {};
  for (const [k, v] of lastPerformances) {
    lastPerfRecord[k] = serializePerf(v);
  }

  return <SessionRunner session={session} lastPerformances={lastPerfRecord} />;
}

function serializePerf(p: LastPerformance): SerializedLastPerformance {
  return {
    sessionStartedAt: p.sessionStartedAt.toISOString(),
    sets: p.sets,
    maxWeight: p.maxWeight,
    repsAtMaxWeight: p.repsAtMaxWeight,
  };
}
