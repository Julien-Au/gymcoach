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
    // Ownership lives in the query scope itself (issue #317).
    const goal = await db.exerciseGoal.findFirst({ where: { id: params.id, userId } });
    if (!goal) {
      throw new ApiError(404, 'Goal not found.');
    }
    await db.exerciseGoal.delete({ where: { id: params.id, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
