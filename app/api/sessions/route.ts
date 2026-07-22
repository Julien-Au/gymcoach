import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionStartSchema } from '@/lib/schemas/session';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const sessions = await db.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: {
        workout: { select: { name: true } },
        program: { select: { name: true } },
        _count: { select: { sets: true } },
      },
      take: 50,
    });
    return NextResponse.json(sessions);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/sessions: starts a new session on one of the user's workouts.
// Fails if an unfinished session already exists on the same workout
// (avoids zombie sessions created by a double-click).
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const { workoutId, gymId } = await parseJsonBody(req, sessionStartSchema);

    const workout = await db.workout.findUnique({
      where: { id: workoutId },
      include: { program: { select: { userId: true, id: true } } },
    });
    if (!workout || workout.program.userId !== userId) {
      throw new ApiError(404, 'Session not found.');
    }

    const selectedGymId =
      gymId ??
      (await db.user.findUnique({ where: { id: userId }, select: { activeGymId: true } }))
        ?.activeGymId ??
      null;
    if (selectedGymId) {
      const gym = await db.gym.findFirst({
        where: { id: selectedGymId, userId },
        select: { id: true },
      });
      if (!gym) throw new ApiError(400, 'Invalid gym.');
    }

    const inProgress = await db.session.findFirst({
      where: { userId, workoutId, finishedAt: null },
    });
    if (inProgress) {
      // We return the existing session instead of creating a new one:
      // allows resuming cleanly after a reload.
      return NextResponse.json(inProgress, { status: 200 });
    }

    const created = await db.session.create({
      data: {
        userId,
        workoutId,
        programId: workout.program.id,
        gymId: selectedGymId,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
