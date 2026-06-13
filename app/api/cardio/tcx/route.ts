import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';
import { serializeTcx, sportForExerciseName, type TcxExportActivity } from '@/lib/import/tcx-export';

// GET /api/cardio/tcx?sessionId=...
// Exports a session's cardio sets as a minimal, valid TCX 1.0 Activity (the
// outbound half of data ownership, issue #175). Ownership-scoped exactly like
// /api/history/csv: a session that is not the caller's returns 404 (never
// another user's data). A session with no cardio sets returns 400 - there is
// nothing to export as TCX, and the UI does not show the button for it.
export async function GET(req: Request) {
  try {
    const userId = await requireApiUserId();
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      throw new ApiError(400, 'Missing sessionId.');
    }

    // Ownership is enforced in the query: scoping on userId means a foreign
    // sessionId simply yields no row -> 404, identical-looking to a missing one,
    // so we never confirm another user's session exists.
    const session = await db.session.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        startedAt: true,
        sets: {
          where: { durationSec: { not: null } },
          orderBy: { setNumber: 'asc' },
          select: {
            durationSec: true,
            distanceM: true,
            avgHr: true,
            exercise: { select: { name: true } },
          },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, 'Session not found.');
    }
    if (session.sets.length === 0) {
      throw new ApiError(400, 'This session has no cardio sets to export.');
    }

    // The activity sport comes from the first cardio set's exercise; a TCX
    // Activity carries a single Sport, and a session is overwhelmingly one
    // discipline. Each cardio set becomes one Lap.
    const sport = sportForExerciseName(session.sets[0]!.exercise.name);
    const activity: TcxExportActivity = {
      startedAt: session.startedAt,
      sport,
      laps: session.sets.map((s) => ({
        durationSec: s.durationSec!,
        distanceM: s.distanceM,
        avgHr: s.avgHr,
      })),
    };

    const body = serializeTcx(activity);
    const filename = `gymcoach-${session.startedAt.toISOString().slice(0, 10)}.tcx`;
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/vnd.garmin.tcx+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
