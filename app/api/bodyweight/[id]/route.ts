import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';
import { currentBodyweightFromEntries } from '@/lib/bodyweight';

interface Params {
  params: { id: string };
}

// DELETE /api/bodyweight/[id]: remove one measurement. User.bodyweight is the
// "current value" mirror of the newest entry, so after the delete it re-syncs
// to the newest remaining entry. When no entries remain the profile value is
// left as is (it may predate the history, and clearing it would silently
// change effective-load math).
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    const entry = await db.bodyweightEntry.findUnique({ where: { id: params.id } });
    if (!entry || entry.userId !== userId) {
      throw new ApiError(404, 'Entry not found.');
    }

    await db.$transaction(async (tx) => {
      await tx.bodyweightEntry.delete({ where: { id: params.id } });
      const remaining = await tx.bodyweightEntry.findMany({
        where: { userId },
        orderBy: { measuredAt: 'asc' },
        select: { weightKg: true, measuredAt: true },
      });
      const current = currentBodyweightFromEntries(remaining);
      if (current !== null) {
        await tx.user.update({
          where: { id: userId },
          data: { bodyweight: current },
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
