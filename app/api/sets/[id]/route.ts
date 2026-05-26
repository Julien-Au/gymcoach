import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

interface Params {
  params: { id: string };
}

// DELETE /api/sets/[id]: deletes a set (e.g. an input mistake).
// The user can then re-enter it. No PUT for LOT 5, editing will come later.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    const set = await db.set.findUnique({
      where: { id: params.id },
      include: { session: { select: { userId: true } } },
    });
    if (!set || set.session.userId !== userId) {
      throw new ApiError(404, 'Set not found.');
    }
    await db.set.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
