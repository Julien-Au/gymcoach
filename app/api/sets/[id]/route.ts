import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';
import { findAchievingSet } from '@/lib/goals';
import { effectiveWeight } from '@/lib/stats';

interface Params {
  params: { id: string };
}

// DELETE /api/sets/[id]: deletes a set (e.g. an input mistake).
// The user can then re-enter it. No PUT for LOT 5, editing will come later.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    const set = await db.set.findUnique({
      where: { id: params.id },
      include: { session: { select: { userId: true } } },
    });
    if (!set || set.session.userId !== userId) {
      throw new ApiError(404, 'Set not found.');
    }
    await db.set.delete({ where: { id: params.id } });
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
  if (!goal || !goal.achievedAt) return;

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
  if (achievedAt?.getTime() !== goal.achievedAt.getTime()) {
    await db.exerciseGoal.update({
      where: { id: goal.id },
      data: { achievedAt },
    });
  }
}
