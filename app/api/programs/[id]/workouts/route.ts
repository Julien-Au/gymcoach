import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workoutInputSchema } from '@/lib/schemas/workout';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/programs/[id]/workouts: adds a workout to a program.
// The order is computed automatically (max + 1).
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const program = await db.program.findUnique({ where: { id: params.id } });
    if (!program || program.userId !== userId) {
      throw new ApiError(404, 'Program not found.');
    }

    const data = await parseJsonBody(req, workoutInputSchema);
    const last = await db.workout.findFirst({
      where: { programId: params.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (last?.order ?? 0) + 1;

    const workout = await db.workout.create({
      data: {
        programId: params.id,
        name: data.name,
        dayOfWeek: data.dayOfWeek ?? null,
        order: nextOrder,
      },
    });
    return NextResponse.json(workout, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
