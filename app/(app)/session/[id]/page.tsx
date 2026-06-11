import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { getLastPerformances, type LastPerformance } from '@/lib/last-performance';
import { READINESS_RECENCY_HOURS, type ReadinessSignal } from '@/lib/progression';
import { isDeloadActive } from '@/lib/deload';
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
    // Session already finished: redirect to home. In LOT 8 we will point
    // to the session history page.
    redirect('/');
  }
  if (!session.workout) notFound();

  const exerciseIds = session.workout.exercises.map((pe) => pe.exerciseId);
  const [lastPerformances, user, latestCheckin] = await Promise.all([
    getLastPerformances(auth.userId, exerciseIds, session.id),
    db.user.findUnique({
      where: { id: auth.userId },
      select: { unit: true, deloadUntil: true },
    }),
    db.readinessCheckin.findFirst({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const lastPerfRecord: Record<string, SerializedLastPerformance> = {};
  for (const [k, v] of lastPerformances) {
    lastPerfRecord[k] = serializePerf(v);
  }

  const readiness = buildReadinessSignal(latestCheckin);
  // Planned deload week (issue #112): resolved against the clock here so the
  // client never reasons about dates; an expired deloadUntil has no effect.
  const deloadActive = isDeloadActive(user?.deloadUntil ?? null, new Date());

  return (
    <SessionRunner
      session={session}
      lastPerformances={lastPerfRecord}
      readiness={readiness}
      deloadActive={deloadActive}
      unit={user?.unit ?? 'KG'}
    />
  );
}

// Turn the latest check-in into the readiness signal that drives the load
// suggestion. We only forward an in-window check-in; a stale one is dropped here
// so the client never has to reason about clocks (and the suggestion stays
// identical to the no-data path). Returns null when there is no usable signal.
function buildReadinessSignal(
  checkin: {
    readiness: number;
    soreness: unknown;
    createdAt: Date;
  } | null,
): ReadinessSignal | null {
  if (!checkin) return null;
  const ageHours = (Date.now() - checkin.createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours > READINESS_RECENCY_HOURS) return null;

  // soreness is stored as JSON; coerce defensively to a plain { group: 1-5 } map.
  let soreness: ReadinessSignal['soreness'] = null;
  if (checkin.soreness && typeof checkin.soreness === 'object' && !Array.isArray(checkin.soreness)) {
    const entries = Object.entries(checkin.soreness as Record<string, unknown>).filter(
      ([, v]) => typeof v === 'number',
    ) as Array<[string, number]>;
    if (entries.length > 0) {
      soreness = Object.fromEntries(entries) as ReadinessSignal['soreness'];
    }
  }

  return { readiness: checkin.readiness, soreness, ageHours };
}

function serializePerf(p: LastPerformance): SerializedLastPerformance {
  return {
    sessionStartedAt: p.sessionStartedAt.toISOString(),
    sets: p.sets,
    maxWeight: p.maxWeight,
    repsAtMaxWeight: p.repsAtMaxWeight,
  };
}
