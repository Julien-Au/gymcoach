import { NextResponse } from 'next/server';
import type { Prisma } from '@/prisma/generated/client';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { readinessCheckinInputSchema } from '@/lib/schemas/readiness';

// GET /api/readiness: the user's latest readiness check-in (or null).
export async function GET() {
  try {
    const userId = await requireApiUserId();
    const latest = await db.readinessCheckin.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(latest ?? null);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/readiness: records a new readiness check-in for the user.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, readinessCheckinInputSchema);
    const created = await db.readinessCheckin.create({
      data: {
        userId,
        readiness: data.readiness,
        sleepQuality: data.sleepQuality,
        soreness: (data.soreness ?? undefined) as Prisma.InputJsonValue | undefined,
        note: data.note ?? null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
