import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programExerciseInputSchema } from '@/lib/schemas/program-exercise';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

interface Params {
  params: { id: string };
}

async function ensureOwnership(id: string, userId: string) {
  const pe = await db.programExercise.findUnique({
    where: { id },
    include: { workout: { include: { program: { select: { userId: true } } } } },
  });
  if (!pe || pe.workout.program.userId !== userId) {
    throw new ApiError(404, 'Program exercise not found.');
  }
  return pe;
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    await ensureOwnership(params.id, userId);
    const data = await parseJsonBody(req, programExerciseInputSchema);

    const exercise = await db.exercise.findUnique({ where: { id: data.exerciseId } });
    if (!exercise || exercise.userId !== userId) {
      throw new ApiError(400, 'Invalid exercise.');
    }

    const updated = await db.programExercise.update({
      where: { id: params.id },
      data: {
        exerciseId: data.exerciseId,
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
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    await ensureOwnership(params.id, userId);
    await db.programExercise.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
