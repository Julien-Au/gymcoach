import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exerciseInputSchema } from '@/lib/schemas/exercise';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

// Ownership is enforced by scoping every query with userId (issue #317):
// the reads that serve the responses are themselves the checks, and the
// writes carry userId in their where, so a stranger's id yields 404.

export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const exercise = await db.exercise.findFirst({ where: { id: params.id, userId } });
    if (!exercise) throw new ApiError(404, 'Exercise not found.');
    return NextResponse.json(exercise);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, exerciseInputSchema);
    const updated = await db.exercise.update({
      where: { id: params.id, userId },
      data: { ...data, notes: data.notes ?? null },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();

    // Check whether the exercise is used in an active program or in sets.
    // If so, we refuse to avoid breaking the data. The user must first remove
    // the exercise from the programs or create a variant.
    const usage = await db.exercise.findFirst({
      where: { id: params.id, userId },
      select: {
        _count: { select: { programExercises: true, sets: true } },
      },
    });
    if (!usage) throw new ApiError(404, 'Exercise not found.');
    if (usage._count.programExercises > 0 || usage._count.sets > 0) {
      throw new ApiError(
        409,
        'Exercise used in a program or in history. Remove it first.',
      );
    }

    await db.exercise.delete({ where: { id: params.id, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
