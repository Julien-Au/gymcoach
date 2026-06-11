import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { hevyImportInputSchema } from '@/lib/schemas/import';
import { HEVY_CSV_MAX_BYTES, parseHevyCsv } from '@/lib/import/hevy-csv';
import {
  buildStrongImportPlan,
  executeStrongImport,
  setDuplicateKey,
} from '@/lib/import/strong-import';

// How many per-line errors the response reports (the count is always exact).
const MAX_REPORTED_ERRORS = 50;

// POST /api/import/hevy: import a Hevy app CSV export (issue #113). Mirrors
// /api/import/strong - which stays untouched - with the Hevy parser in front
// of the shared planner/executor. mode=preview parses and plans without
// writing anything; mode=confirm performs the import inside one transaction.
// The file content is untrusted: hard caps, Zod on every value (in the parser
// and on the body), and no write outside the transaction.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();

    // Shared budget with the Strong route: one import allowance per user.
    const rl = rateLimit(`import:${userId}`, 10, 60_000);
    if (!rl.ok) {
      throw new ApiError(429, `Too many import requests. Retry in ${rl.retryAfterSec}s.`);
    }

    // Cheap early reject on a declared oversize. The header is advisory only
    // (absent on chunked bodies, possibly malformed); the real control is the
    // streamed byte cap inside parseJsonBody below.
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > HEVY_CSV_MAX_BYTES * 1.5) {
      throw new ApiError(413, 'File too large: the limit is 5 MB.');
    }

    const data = await parseJsonBody(req, hevyImportInputSchema, {
      // 1.5x leaves room for the JSON envelope and string escaping around the
      // 5 MB CSV payload itself (which the schema caps exactly).
      maxBytes: HEVY_CSV_MAX_BYTES * 1.5,
    });
    const parsed = parseHevyCsv(data.csv);
    if (!parsed.ok) {
      throw new ApiError(400, parsed.fatalError ?? 'Unreadable file.');
    }

    // Existing data on the imported days, for duplicate skipping and the
    // "you already trained that day" preview warning.
    const dateKeys = [...new Set(parsed.rows.map((r) => r.dateKey))].sort();
    const existingSetKeys = new Set<string>();
    const existingSessionDates = new Set<string>();
    if (dateKeys.length > 0) {
      const rangeStart = new Date(`${dateKeys[0]}T00:00:00.000Z`);
      const rangeEnd = new Date(`${dateKeys[dateKeys.length - 1]}T00:00:00.000Z`);
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
      const sessions = await db.session.findMany({
        where: { userId, startedAt: { gte: rangeStart, lt: rangeEnd } },
        select: {
          startedAt: true,
          sets: {
            select: {
              setNumber: true,
              weight: true,
              reps: true,
              exercise: { select: { name: true } },
            },
          },
        },
      });
      for (const session of sessions) {
        const dateKey = session.startedAt.toISOString().slice(0, 10);
        existingSessionDates.add(dateKey);
        for (const set of session.sets) {
          existingSetKeys.add(
            setDuplicateKey(dateKey, set.exercise.name, set.setNumber, set.weight, set.reps),
          );
        }
      }
    }

    const exercises = await db.exercise.findMany({
      where: { userId },
      select: { name: true },
    });
    const plan = buildStrongImportPlan(
      parsed.rows,
      exercises.map((e) => e.name),
      existingSetKeys,
    );

    const common = {
      duplicatesSkipped: plan.duplicateCount,
      cardioSkipped: parsed.cardioSkipped,
      errorCount: parsed.errors.length,
      errors: parsed.errors.slice(0, MAX_REPORTED_ERRORS),
    };

    if (data.mode === 'preview') {
      return NextResponse.json({
        mode: 'preview',
        sessions: plan.sessions.length,
        sets: plan.totalSets,
        newExercises: plan.newExerciseNames,
        existingSessionDates: [...existingSessionDates]
          .filter((d) => dateKeys.includes(d))
          .sort(),
        ...common,
      });
    }

    if (plan.totalSets === 0) {
      throw new ApiError(400, 'Nothing to import: no valid, non-duplicate set found.');
    }

    // One transaction per import: a failure anywhere rolls back every row.
    // A multi-year export creates hundreds of sessions in sequential writes,
    // so the 5 s Prisma default timeout would abort exactly the imports this
    // feature exists for.
    const result = await db.$transaction(
      async (tx) => executeStrongImport(tx, userId, plan, 'Hevy'),
      { timeout: 60_000, maxWait: 5_000 },
    );

    return NextResponse.json({
      mode: 'confirm',
      createdSessions: result.createdSessions,
      createdSets: result.createdSets,
      createdExercises: result.createdExercises,
      ...common,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
