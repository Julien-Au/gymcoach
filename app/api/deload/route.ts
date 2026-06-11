import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { DELOAD_DURATION_DAYS } from '@/lib/deload';
import { deloadStartSchema } from '@/lib/schemas/deload';

// One-tap planned deload week (issue #112). Both handlers operate strictly on
// the authenticated user's own row (requireApiUserId), so ownership is
// enforced by construction - there is no way to address another user.

// POST /api/deload: starts a deload week ending DELOAD_DURATION_DAYS from now.
// Re-posting while one is active simply restarts the 7-day window.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    await parseJsonBody(req, deloadStartSchema);
    const deloadUntil = new Date(
      Date.now() + DELOAD_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );
    await db.user.update({
      where: { id: userId },
      data: { deloadUntil },
    });
    return NextResponse.json(
      { deloadUntil: deloadUntil.toISOString() },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/deload: ends the deload now (clears deloadUntil). Idempotent -
// deleting with no active deload is a no-op success.
export async function DELETE() {
  try {
    const userId = await requireApiUserId();
    await db.user.update({
      where: { id: userId },
      data: { deloadUntil: null },
    });
    return NextResponse.json({ deloadUntil: null });
  } catch (err) {
    return handleApiError(err);
  }
}
