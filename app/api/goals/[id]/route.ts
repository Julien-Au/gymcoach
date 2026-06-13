import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

// DELETE /api/goals/[id]: removes one of the user's exercise goals.
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const goal = await db.exerciseGoal.findUnique({ where: { id: params.id } });
    if (!goal || goal.userId !== userId) {
      throw new ApiError(404, 'Goal not found.');
    }
    await db.exerciseGoal.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
