import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

// DELETE /api/measurements/[id] : remove one measurement. Ownership-scoped - a
// row belonging to another user (or a missing id) returns 404 and is never
// deleted, identical to the bodyweight route.
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    // Ownership lives in the query scope itself (issue #317).
    const entry = await db.bodyMeasurement.findFirst({
      where: { id: params.id, userId },
    });
    if (!entry) {
      throw new ApiError(404, 'Measurement not found.');
    }
    await db.bodyMeasurement.delete({ where: { id: params.id, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
