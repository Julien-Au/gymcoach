import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setInputSchema } from '@/lib/schemas/set';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

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

    const created = await db.set.create({
      data: {
        sessionId: params.id,
        exerciseId: data.exerciseId,
        setNumber: data.setNumber,
        weight: data.weight,
        reps: data.reps,
        rir: data.rir ?? null,
        notes: data.notes ?? null,
        isWarmup: data.isWarmup ?? false,
        isDropSet: data.isDropSet ?? false,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
