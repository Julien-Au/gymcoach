import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programExerciseInputSchema } from '@/lib/schemas/program-exercise';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

interface Params {
  params: { id: string };
}

// POST /api/workouts/[id]/program-exercises: adds an exercise (with its targets)
// to a workout. The order is computed automatically.
export async function POST(req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    const workout = await db.workout.findUnique({
      where: { id: params.id },
      include: { program: { select: { userId: true } } },
    });
    if (!workout || workout.program.userId !== userId) {
      throw new ApiError(404, 'Session not found.');
    }

    const data = await parseJsonBody(req, programExerciseInputSchema);

    // Check that the exercise belongs to the user.
    const exercise = await db.exercise.findUnique({ where: { id: data.exerciseId } });
    if (!exercise || exercise.userId !== userId) {
      throw new ApiError(400, 'Invalid exercise.');
    }

    const last = await db.programExercise.findFirst({
      where: { workoutId: params.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (last?.order ?? 0) + 1;

    const created = await db.programExercise.create({
      data: {
        workoutId: params.id,
        exerciseId: data.exerciseId,
        order: nextOrder,
        targetSets: data.targetSets,
        targetRepsMin: data.targetRepsMin,
        targetRepsMax: data.targetRepsMax,
        targetRIR: data.targetRIR,
        restSec: data.restSec,
        tempo: data.tempo ?? null,
        notes: data.notes ?? null,
      },
      include: { exercise: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
