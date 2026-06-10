import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bodyweightEntryInputSchema } from '@/lib/schemas/bodyweight';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { currentBodyweightFromEntries } from '@/lib/bodyweight';

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

// POST /api/bodyweight: log a measurement. User.bodyweight (the current value
// the rest of the app reads) re-syncs to the newest entry in the same
// transaction. The user row is locked first so concurrent mutations
// serialize: "stamped now, so newest by construction" does not hold at
// ReadCommitted, where the commit order on the user row can disagree with the
// measuredAt order (issue #107).
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, bodyweightEntryInputSchema);

    const entry = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const created = await tx.bodyweightEntry.create({
        data: { userId, weightKg: data.weightKg, note: data.note ?? null },
      });
      const entries = await tx.bodyweightEntry.findMany({
        where: { userId },
        orderBy: [{ measuredAt: 'asc' }, { id: 'asc' }],
        select: { weightKg: true, measuredAt: true },
      });
      const current = currentBodyweightFromEntries(entries);
      if (current !== null) {
        await tx.user.update({
          where: { id: userId },
          data: { bodyweight: current },
        });
      }
      return created;
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
