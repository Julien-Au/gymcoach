import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  bodyMeasurementInputSchema,
  bodyMeasurementListQuerySchema,
} from '@/lib/schemas/measurement';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

// GET /api/measurements?site=WAIST : the user's measurement history, newest
// first. The optional site filter narrows to one site; an invalid site value
// is ignored (all sites) rather than rejected.
export async function GET(req: Request) {
  try {
    const userId = await requireApiUserId();
    const url = new URL(req.url);
    const parsed = bodyMeasurementListQuerySchema.safeParse({
      site: url.searchParams.get('site') ?? undefined,
    });
    const site = parsed.success ? parsed.data.site : undefined;

    const entries = await db.bodyMeasurement.findMany({
      where: { userId, ...(site ? { site } : {}) },
      orderBy: { measuredAt: 'desc' },
    });
    return NextResponse.json(entries);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/measurements : log one measurement. Ownership-scoped: the row is
// always created under the authenticated user, so a payload can never write
// another user's data. Value is stored in cm (the client converts).
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, bodyMeasurementInputSchema);

    const entry = await db.bodyMeasurement.create({
      data: {
        userId,
        site: data.site,
        valueCm: data.valueCm,
        note: data.note ?? null,
      },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
