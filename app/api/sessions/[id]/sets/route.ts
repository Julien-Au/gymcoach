import { NextResponse } from 'next/server';
import type { Exercise, Set } from '@prisma/client';
import { db } from '@/lib/db';
import { setInputSchema, validateSetForCategory } from '@/lib/schemas/set';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { setAchievesGoal } from '@/lib/goals';
import { effectiveWeight } from '@/lib/stats';

interface Params {
  params: { id: string };
}

// POST /api/sessions/[id]/sets: records a set in a session.
export async function POST(req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();

    const session = await db.session.findUnique({ where: { id: params.id } });
    if (!session || session.userId !== userId) {
      throw new ApiError(404, 'Session not found.');
    }
    if (session.finishedAt) {
      throw new ApiError(400, 'Session already finished.');
    }

    const data = await parseJsonBody(req, setInputSchema);

    // Validation: the exercise must belong to the user.
    const exercise = await db.exercise.findUnique({ where: { id: data.exerciseId } });
    if (!exercise || exercise.userId !== userId) {
      throw new ApiError(400, 'Invalid exercise.');
    }

    // Cardio cross-field rule (issue #133): duration/distance only on CARDIO
    // exercises, and a cardio set requires a duration.
    const categoryError = validateSetForCategory(exercise.category, data);
    if (categoryError) {
      throw new ApiError(400, categoryError);
    }
    const isCardio = exercise.category === 'CARDIO';

    const created = await db.set.create({
      data: {
        sessionId: params.id,
        exerciseId: data.exerciseId,
        setNumber: data.setNumber,
        // Cardio sets store weight = 0 / reps = 1 by convention (the columns
        // are NOT NULL); the UI never shows them for CARDIO exercises.
        weight: isCardio ? 0 : data.weight,
        reps: isCardio ? 1 : data.reps,
        rir: isCardio ? null : (data.rir ?? null),
        durationSec: isCardio ? data.durationSec : null,
        distanceM: isCardio ? (data.distanceM ?? null) : null,
        avgHr: isCardio ? (data.avgHr ?? null) : null,
        notes: data.notes ?? null,
        isWarmup: data.isWarmup ?? false,
        isDropSet: data.isDropSet ?? false,
      },
    });
    // Best-effort: the set is already committed, so a failure here must never
    // fail the request (a 500 would make the offline sync retry the POST and
    // duplicate the set). An unstamped goal self-heals on the next achieving
    // set or on goal re-creation, which re-derives achievedAt from history.
    try {
      await stampGoalIfAchieved(userId, exercise, created);
    } catch (stampErr) {
      console.error('[api] goal achievement stamping failed:', stampErr);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Per-exercise goal (issue #90): when a freshly logged working set meets an
// unachieved goal's target, stamp achievedAt with the set's completedAt
// (deterministic - the same instant the goal-creation path would derive).
// Comparison runs on the effective load (bodyweight + added load for
// bodyweight exercises), consistent with lib/stats.
async function stampGoalIfAchieved(
  userId: string,
  exercise: Exercise,
  set: Set,
): Promise<void> {
  if (set.isWarmup) return;
  const goal = await db.exerciseGoal.findUnique({
    where: { userId_exerciseId: { userId, exerciseId: exercise.id } },
  });
  if (!goal || goal.achievedAt) return;

  let weight = set.weight;
  if (exercise.usesBodyweight) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { bodyweight: true },
    });
    weight = effectiveWeight(set.weight, true, user?.bodyweight);
  }
  if (setAchievesGoal({ weight, reps: set.reps, isWarmup: set.isWarmup }, goal)) {
    await db.exerciseGoal.update({
      where: { id: goal.id },
      data: { achievedAt: set.completedAt },
    });
  }
}
