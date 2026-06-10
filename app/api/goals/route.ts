import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { goalInputSchema } from '@/lib/schemas/goal';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { findAchievingSet } from '@/lib/goals';
import { applyBodyweight } from '@/lib/stats';

// GET /api/goals: the user's exercise goals, with the exercise identity.
export async function GET() {
  try {
    const userId = await requireApiUserId();
    const goals = await db.exerciseGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        exercise: { select: { id: true, name: true, usesBodyweight: true } },
      },
    });
    return NextResponse.json(goals);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/goals: create or replace the goal for one of the user's
// exercises (one active goal per exercise - upsert on the unique constraint).
// achievedAt is re-derived deterministically from the logged sets: if a past
// working set already meets the target, the goal is achieved as of that set's
// completedAt; otherwise it starts unachieved and gets stamped at set-save.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, goalInputSchema);

    const exercise = await db.exercise.findUnique({ where: { id: data.exerciseId } });
    if (!exercise || exercise.userId !== userId) {
      throw new ApiError(404, 'Exercise not found.');
    }

    // All working sets of this exercise, bodyweight-adjusted so the
    // comparison runs on effective load (same semantics as lib/stats).
    const [user, sets] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { bodyweight: true } }),
      db.set.findMany({
        where: { exerciseId: data.exerciseId, isWarmup: false, session: { userId } },
        select: { weight: true, reps: true, isWarmup: true, completedAt: true },
      }),
    ]);
    const adjusted = applyBodyweight(
      sets.map((s) => ({ ...s, usesBodyweight: exercise.usesBodyweight })),
      user?.bodyweight,
    );
    const achieving = findAchievingSet(adjusted, data);

    const goal = await db.exerciseGoal.upsert({
      where: { userId_exerciseId: { userId, exerciseId: data.exerciseId } },
      create: {
        userId,
        exerciseId: data.exerciseId,
        targetWeight: data.targetWeight,
        targetReps: data.targetReps,
        achievedAt: achieving?.completedAt ?? null,
      },
      update: {
        targetWeight: data.targetWeight,
        targetReps: data.targetReps,
        achievedAt: achieving?.completedAt ?? null,
        // Replacing the goal restarts its lifetime.
        createdAt: new Date(),
      },
    });
    return NextResponse.json(goal, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
