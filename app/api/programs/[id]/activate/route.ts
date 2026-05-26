import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

interface Params {
  params: { id: string };
}

// POST /api/programs/[id]/activate
// Active ce programme et désactive tous les autres pour ce user.
// Body optionnel : { active: boolean } (défaut true). Si active=false,
// on désactive simplement ce programme (pas d'auto-activation d'un autre).
export async function POST(req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    const program = await db.program.findUnique({ where: { id: params.id } });
    if (!program || program.userId !== userId) {
      throw new ApiError(404, 'Programme introuvable.');
    }

    const body = (await req.json().catch(() => ({}))) as { active?: boolean };
    const active = body.active !== false;

    if (active) {
      await db.$transaction([
        db.program.updateMany({
          where: { userId, isActive: true, id: { not: params.id } },
          data: { isActive: false },
        }),
        db.program.update({ where: { id: params.id }, data: { isActive: true } }),
      ]);
    } else {
      await db.program.update({ where: { id: params.id }, data: { isActive: false } });
    }

    const updated = await db.program.findUnique({ where: { id: params.id } });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
