import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workoutInputSchema } from '@/lib/schemas/workout';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

async function ensureOwnership(workoutId: string, userId: string) {
  const workout = await db.workout.findUnique({
    where: { id: workoutId },
    include: { program: { select: { userId: true } } },
  });
  if (!workout || workout.program.userId !== userId) {
    throw new ApiError(404, 'Session not found.');
  }
  return workout;
}

export async function PUT(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    await ensureOwnership(params.id, userId);
    const data = await parseJsonBody(req, workoutInputSchema);
    const updated = await db.workout.update({
      where: { id: params.id },
      data: { name: data.name, dayOfWeek: data.dayOfWeek ?? null },
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
    await ensureOwnership(params.id, userId);
    await db.workout.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
