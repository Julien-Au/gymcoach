import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import {
  volumeTargetInputSchema,
  volumeTargetClearSchema,
} from '@/lib/schemas/volume-target';

// Per-muscle weekly volume targets (issue #211). Every handler operates strictly
// on the authenticated user's own rows (requireApiUserId + a userId-scoped
// where/unique), so ownership is enforced by construction - there is no way to
// address or clobber another user's target.

// GET /api/volume-targets: the user's saved per-muscle bands.
export async function GET() {
  try {
    const userId = await requireApiUserId();
    const targets = await db.volumeTarget.findMany({
      where: { userId },
      select: { muscleGroup: true, mev: true, mrv: true },
    });
    return NextResponse.json(targets);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/volume-targets: set (upsert) the band for one muscle group. The Zod
// schema bounds mev/mrv (1..40) and enforces mrv > mev; one row per
// (userId, muscleGroup) via the unique constraint.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, volumeTargetInputSchema);
    const target = await db.volumeTarget.upsert({
      where: {
        userId_muscleGroup: { userId, muscleGroup: data.muscleGroup },
      },
      create: {
        userId,
        muscleGroup: data.muscleGroup,
        mev: data.mev,
        mrv: data.mrv,
      },
      update: { mev: data.mev, mrv: data.mrv },
      select: { muscleGroup: true, mev: true, mrv: true },
    });
    return NextResponse.json(target, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/volume-targets: clear (reset to default) the band for one muscle
// group. Idempotent - deleting an absent target is a no-op success, so the
// group falls back to the global defaults.
export async function DELETE(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, volumeTargetClearSchema);
    await db.volumeTarget.deleteMany({
      where: { userId, muscleGroup: data.muscleGroup },
    });
    return NextResponse.json({ muscleGroup: data.muscleGroup, cleared: true });
  } catch (err) {
    return handleApiError(err);
  }
}
