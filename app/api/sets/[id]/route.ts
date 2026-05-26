import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

interface Params {
  params: { id: string };
}

// DELETE /api/sets/[id] : supprime une série (ex. erreur de saisie).
// L'utilisateur peut ensuite la ressaisir. Pas de PUT pour LOT 5,
// l'édition viendra plus tard.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    const set = await db.set.findUnique({
      where: { id: params.id },
      include: { session: { select: { userId: true } } },
    });
    if (!set || set.session.userId !== userId) {
      throw new ApiError(404, 'Série introuvable.');
    }
    await db.set.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
