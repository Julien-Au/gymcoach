import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { fitImportInputSchema } from '@/lib/schemas/import';
import { parseFit, fitExerciseName, FIT_MAX_BYTES } from '@/lib/import/fit';

// How close an existing session's start has to be to count as a likely
// duplicate of the imported activity (the preview warns; confirm still works).
// Same window as the TCX/GPX imports.
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

// POST /api/import/fit: import a Garmin FIT activity file as one cardio session
// (issue #249). Mirrors the hardened GPX/TCX import routes: streamed body cap,
// the SHARED import rate bucket, dry-run preview, transactional confirm. The
// file is an untrusted BINARY blob carried base64-encoded; lib/import/fit.ts
// bounds-checks every offset by construction, verifies the FIT CRC, and bounds
// every persisted value.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();

    // Shared "import:" bucket: FIT shares the same per-user import budget as the
    // CSV/TCX/GPX imports so a single user cannot fan out across formats.
    const rl = rateLimit(`import:${userId}`, 10, 60_000);
    if (!rl.ok) {
      throw new ApiError(429, `Too many import requests. Retry in ${rl.retryAfterSec}s.`);
    }

    // Cheap early reject on a declared oversize. The header is advisory only;
    // the real control is the streamed byte cap inside parseJsonBody and the
    // decoded-length check inside parseFit.
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > FIT_MAX_BYTES * 2) {
      throw new ApiError(413, 'File too large: the limit is 5 MB.');
    }

    const data = await parseJsonBody(req, fitImportInputSchema, {
      // 2x leaves room for the JSON envelope and the base64 inflation (~4/3) of
      // the up-to-5 MB binary payload (which the schema caps exactly).
      maxBytes: FIT_MAX_BYTES * 2,
    });

    const parsed = parseFit(new Uint8Array(Buffer.from(data.fit, 'base64')));
    if (!parsed.ok || !parsed.activity) {
      throw new ApiError(400, parsed.fatalError ?? 'Unreadable file.');
    }
    const activity = parsed.activity;
    const exerciseName = fitExerciseName(activity.sport);

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
      maxHr: activity.maxHr,
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
            notes: 'Created by the FIT import.',
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
          notes: `Imported from a FIT file (${activity.sport}).`,
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
          maxHr: activity.maxHr,
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
