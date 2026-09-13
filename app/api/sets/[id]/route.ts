import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Prisma } from '@/lib/prisma-client';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { findAchievingSet } from '@/lib/goals';
import { setUpdateSchema } from '@/lib/schemas/set';
import { effectiveWeight } from '@/lib/stats';

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH /api/sets/[id]: correct logged strength values in place.
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, setUpdateSchema);

    const updated = await runSerializableSetTransaction(async (tx) => {
      // Serialize same-set mutations first, then serialize goal re-derivation
      // for the exercise. The set values and derived achievedAt now commit or
      // roll back together instead of leaving a stale goal after a successful edit.
      await tx.$queryRaw`SELECT "Set".id FROM "Set" JOIN "Session" ON "Session".id = "Set"."sessionId" WHERE "Set".id = ${params.id} AND "Session"."userId" = ${userId} FOR UPDATE OF "Set"`;
      const set = await tx.set.findFirst({
        where: { id: params.id, session: { userId } },
        include: {
          session: { select: { finishedAt: true } },
          exercise: { select: { category: true } },
        },
      });
      if (!set) {
        throw new ApiError(404, 'Set not found.');
      }
      if (set.session.finishedAt) {
        throw new ApiError(400, 'Session already finished.');
      }
      if (set.exercise.category === 'CARDIO') {
        throw new ApiError(400, 'Cardio sets cannot be edited with strength fields.');
      }

      await lockExerciseGoal(tx, userId, set.exerciseId);
      const row = await tx.set.update({
        where: { id: set.id, session: { userId } },
        data: { weight: data.weight, reps: data.reps, rir: data.rir },
      });
      await rederiveGoalAchievement(tx, userId, set.exerciseId, true);
      return row;
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/sets/[id]: deletes a set (e.g. an input mistake).
// The user can then re-enter it; value corrections use PATCH above.
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    await runSerializableSetTransaction(async (tx) => {
      await tx.$queryRaw`SELECT "Set".id FROM "Set" JOIN "Session" ON "Session".id = "Set"."sessionId" WHERE "Set".id = ${params.id} AND "Session"."userId" = ${userId} FOR UPDATE OF "Set"`;
      const set = await tx.set.findFirst({
        where: { id: params.id, session: { userId } },
      });
      if (!set) {
        throw new ApiError(404, 'Set not found.');
      }

      await lockExerciseGoal(tx, userId, set.exerciseId);
      await tx.set.delete({ where: { id: params.id, session: { userId } } });
      await rederiveGoalAchievement(tx, userId, set.exerciseId, false);
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

const MAX_SERIALIZABLE_ATTEMPTS = 3;

async function runSerializableSetTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (err) {
      const isWriteConflict =
        typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2034';
      if (!isWriteConflict || attempt === MAX_SERIALIZABLE_ATTEMPTS) throw err;
    }
  }

  throw new Error('Serializable set transaction retry exhausted.');
}

async function lockExerciseGoal(
  tx: Prisma.TransactionClient,
  userId: string,
  exerciseId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "ExerciseGoal" WHERE "userId" = ${userId} AND "exerciseId" = ${exerciseId} FOR UPDATE`;
}

// A deleted set may have been the one that stamped the exercise's goal as
// achieved (issue #96). Re-derive achievedAt from the remaining sets: clear it
// when nothing meets the target anymore, or re-stamp it with the earliest
// remaining achieving set. Comparison runs on the effective load, consistent
// with the stamping path and lib/stats.
async function rederiveGoalAchievement(
  tx: Prisma.TransactionClient,
  userId: string,
  exerciseId: string,
  allowAchievement: boolean,
): Promise<void> {
  const goal = await tx.exerciseGoal.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
  });
  if (!goal || (!allowAchievement && !goal.achievedAt)) return;

  const [exercise, sets] = await Promise.all([
    tx.exercise.findFirst({
      where: { id: exerciseId, userId },
      select: { usesBodyweight: true },
    }),
    tx.set.findMany({
      where: { exerciseId, isWarmup: false, session: { userId } },
      select: { weight: true, reps: true, isWarmup: true, completedAt: true },
    }),
  ]);
  if (!exercise) return;

  let bodyweight: number | null = null;
  if (exercise.usesBodyweight) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { bodyweight: true },
    });
    bodyweight = user?.bodyweight ?? null;
  }

  const achieving = findAchievingSet(
    sets.map((s) => ({
      ...s,
      weight: effectiveWeight(s.weight, exercise.usesBodyweight, bodyweight),
    })),
    goal,
  );
  const achievedAt = achieving?.completedAt ?? null;
  if (achievedAt?.getTime() !== goal.achievedAt?.getTime()) {
    await tx.exerciseGoal.update({
      where: { id: goal.id },
      data: { achievedAt },
    });
  }
}
