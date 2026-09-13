import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
    const set = await db.set.findFirst({
      where: { id: params.id, session: { userId } },
    });
    if (!set) {
      throw new ApiError(404, 'Set not found.');
    }

    const data = await parseJsonBody(req, setUpdateSchema);
    const updated = await db.set.update({
      where: { id: set.id, session: { userId } },
      data: { weight: data.weight, reps: data.reps, rir: data.rir ?? null },
    });

    try {
      await rederiveGoalAchievement(userId, set.exerciseId);
    } catch (rederiveErr) {
      console.error('[api] goal achievement re-derivation failed:', rederiveErr);
    }

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
    // Ownership lives in the query scope itself (issue #317): both the read
    // and the delete carry the owner, so neither survives the removal of the
    // other.
    const set = await db.set.findFirst({
      where: { id: params.id, session: { userId } },
    });
    if (!set) {
      throw new ApiError(404, 'Set not found.');
    }
    await db.set.delete({ where: { id: params.id, session: { userId } } });
    // Best-effort, mirroring the stamping at set-save: the set is already
    // gone, so a failure here must never fail the deletion. A stale
    // achievedAt also self-heals on goal re-creation.
    try {
      await rederiveGoalAchievement(userId, set.exerciseId);
    } catch (rederiveErr) {
      console.error('[api] goal achievement re-derivation failed:', rederiveErr);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// A deleted set may have been the one that stamped the exercise's goal as
// achieved (issue #96). Re-derive achievedAt from the remaining sets: clear it
// when nothing meets the target anymore, or re-stamp it with the earliest
// remaining achieving set. Comparison runs on the effective load, consistent
// with the stamping path and lib/stats.
async function rederiveGoalAchievement(
  userId: string,
  exerciseId: string,
): Promise<void> {
  const goal = await db.exerciseGoal.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
  });
  if (!goal) return;

  const [exercise, sets] = await Promise.all([
    db.exercise.findUnique({
      where: { id: exerciseId },
      select: { usesBodyweight: true },
    }),
    db.set.findMany({
      where: { exerciseId, isWarmup: false, session: { userId } },
      select: { weight: true, reps: true, isWarmup: true, completedAt: true },
    }),
  ]);
  if (!exercise) return;

  let bodyweight: number | null = null;
  if (exercise.usesBodyweight) {
    const user = await db.user.findUnique({
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
    await db.exerciseGoal.update({
      where: { id: goal.id },
      data: { achievedAt },
    });
  }
}
