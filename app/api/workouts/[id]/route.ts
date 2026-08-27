import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workoutInputSchema } from '@/lib/schemas/workout';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

// Ownership is enforced by scoping the write itself through the owning
// program (issue #317): a stranger's id makes Prisma throw P2025, which
// handleApiError maps to 404. No separate check to delete.

export async function PUT(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, workoutInputSchema);
    const updated = await db.workout.update({
      where: { id: params.id, program: { userId } },
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
    await db.workout.delete({ where: { id: params.id, program: { userId } } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
