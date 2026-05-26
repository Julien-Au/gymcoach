import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exerciseInputSchema } from '@/lib/schemas/exercise';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

interface Params {
  params: { id: string };
}

async function ensureOwnership(id: string, userId: string) {
  const exercise = await db.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.userId !== userId) {
    throw new ApiError(404, 'Exercise not found.');
  }
  return exercise;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    const exercise = await ensureOwnership(params.id, userId);
    return NextResponse.json(exercise);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    await ensureOwnership(params.id, userId);
    const data = await parseJsonBody(req, exerciseInputSchema);
    const updated = await db.exercise.update({
      where: { id: params.id },
      data: { ...data, notes: data.notes ?? null },
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

    // Check whether the exercise is used in an active program or in sets.
    // If so, we refuse to avoid breaking the data. The user must first remove
    // the exercise from the programs or create a variant.
    const usage = await db.exercise.findUnique({
      where: { id: params.id },
      select: {
        _count: { select: { programExercises: true, sets: true } },
      },
    });
    if (usage && (usage._count.programExercises > 0 || usage._count.sets > 0)) {
      throw new ApiError(
        409,
        'Exercise used in a program or in history. Remove it first.',
      );
    }

    await db.exercise.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
