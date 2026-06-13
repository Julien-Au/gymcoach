import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/programs/[id]/activate
// Activates this program and deactivates all the others for this user.
// Optional body: { active: boolean } (default true). If active=false,
// we simply deactivate this program (no auto-activation of another one).
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const program = await db.program.findUnique({ where: { id: params.id } });
    if (!program || program.userId !== userId) {
      throw new ApiError(404, 'Program not found.');
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
