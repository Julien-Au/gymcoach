import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bodyweightEntryInputSchema } from '@/lib/schemas/bodyweight';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

// GET /api/bodyweight: the user's bodyweight history, newest first.
export async function GET() {
  try {
    const userId = await requireApiUserId();
    const entries = await db.bodyweightEntry.findMany({
      where: { userId },
      orderBy: { measuredAt: 'desc' },
    });
    return NextResponse.json(entries);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/bodyweight: log a measurement. The new entry is stamped "now", so
// it is the newest by construction and User.bodyweight (the current value the
// rest of the app reads) syncs to it in the same transaction.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, bodyweightEntryInputSchema);

    const entry = await db.$transaction(async (tx) => {
      const created = await tx.bodyweightEntry.create({
        data: { userId, weightKg: data.weightKg, note: data.note ?? null },
      });
      await tx.user.update({
        where: { id: userId },
        data: { bodyweight: data.weightKg },
      });
      return created;
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
