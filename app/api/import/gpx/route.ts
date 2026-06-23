import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { gpxImportInputSchema } from '@/lib/schemas/import';
import { parseGpx, gpxExerciseName, GPX_MAX_BYTES } from '@/lib/import/gpx';
import { Prisma } from '@/prisma/generated/client';

// How close an existing session's start has to be to count as a likely
// duplicate of the imported activity (the preview warns; confirm still works,
// so re-importing on purpose stays possible). Same window as the TCX import.
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

// POST /api/import/gpx: import a GPX track file as one cardio session (issue
// #204). Mirrors the hardened TCX import route: streamed body cap, the SHARED
// import rate bucket, dry-run preview, transactional confirm. The file is
// untrusted XML; lib/import/gpx.ts refuses DTDs/entities by construction, caps
// the trackpoint count, and bounds every persisted value.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();

    // Shared "import:" bucket: GPX shares the same per-user import budget as the
    // CSV and TCX imports so a single user cannot fan out across formats.
    const rl = rateLimit(`import:${userId}`, 10, 60_000);
    if (!rl.ok) {
      throw new ApiError(429, `Too many import requests. Retry in ${rl.retryAfterSec}s.`);
    }

    // Cheap early reject on a declared oversize. The header is advisory only;
    // the real control is the streamed byte cap inside parseJsonBody below.
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > GPX_MAX_BYTES * 1.5) {
      throw new ApiError(413, 'File too large: the limit is 5 MB.');
    }

    const data = await parseJsonBody(req, gpxImportInputSchema, {
      // 1.5x leaves room for the JSON envelope and string escaping around the
      // 5 MB XML payload itself (which the schema caps exactly).
      maxBytes: GPX_MAX_BYTES * 1.5,
    });

    const parsed = parseGpx(data.gpx);
    if (!parsed.ok || !parsed.activity) {
      throw new ApiError(400, parsed.fatalError ?? 'Unreadable file.');
    }
    const activity = parsed.activity;
    const exerciseName = gpxExerciseName(activity.sport);

    // Near-duplicate warning: any session of this user starting within
    // +/-2 minutes of the activity start.
    const nearDuplicates = await db.session.findMany({
      where: {
        userId,
        startedAt: {
          gte: new Date(activity.startedAt.getTime() - DUPLICATE_WINDOW_MS),
          lte: new Date(activity.startedAt.getTime() + DUPLICATE_WINDOW_MS),
        },
      },
      select: { startedAt: true },
      orderBy: { startedAt: 'asc' },
    });

    const summary = {
      sport: activity.sport,
      exerciseName,
      startedAt: activity.startedAt.toISOString(),
      durationSec: activity.durationSec,
      distanceM: activity.distanceM,
      avgHr: activity.avgHr,
      duplicateSessions: nearDuplicates.map((s) => s.startedAt.toISOString()),
    };

    if (data.mode === 'preview') {
      return NextResponse.json({ mode: 'preview', ...summary });
    }

    // Confirm: one transaction creates (or reuses, ownership-scoped) the cardio
    // exercise, the session and its single cardio set.
    const result = await db.$transaction(async (tx) => {
      let exercise = await tx.exercise.findFirst({
        where: { userId, name: exerciseName },
        select: { id: true, category: true },
      });
      let createdExercise = false;
      if (exercise && exercise.category !== 'CARDIO') {
        // The user owns a non-cardio exercise with the default name: never
        // write cardio fields onto it.
        throw new ApiError(
          409,
          `You already have a non-cardio exercise named "${exerciseName}". Rename it and retry.`,
        );
      }
      if (!exercise) {
        exercise = await tx.exercise.create({
          data: {
            userId,
            name: exerciseName,
            muscleGroup: 'OTHER',
            category: 'CARDIO',
            notes: 'Created by the GPX import.',
          },
          select: { id: true, category: true },
        });
        createdExercise = true;
      }

      const finishedAt = new Date(activity.startedAt.getTime() + activity.durationSec * 1000);
      const session = await tx.session.create({
        data: {
          userId,
          startedAt: activity.startedAt,
          finishedAt,
          notes: `Imported from a GPX file (${activity.sport}).`,
        },
      });
      await tx.set.create({
        data: {
          sessionId: session.id,
          exerciseId: exercise.id,
          setNumber: 1,
          // Cardio sets store weight = 0 / reps = 1 by convention (#133).
          weight: 0,
          reps: 1,
          durationSec: activity.durationSec,
          distanceM: activity.distanceM,
          avgHr: activity.avgHr,
          // The downsampled pace/HR track (issue #259), when the file had one.
          ...(activity.track
            ? { track: activity.track as unknown as Prisma.InputJsonValue }
            : {}),
          completedAt: finishedAt,
        },
      });
      return { sessionId: session.id, createdExercise };
    });

    return NextResponse.json({
      mode: 'confirm',
      createdSessions: 1,
      createdSets: 1,
      createdExercises: result.createdExercise ? 1 : 0,
      sessionId: result.sessionId,
      ...summary,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
