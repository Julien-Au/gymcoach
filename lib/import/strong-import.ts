import type { Prisma, PrismaClient } from '@prisma/client';
import type { StrongCsvRow } from '@/lib/import/strong-csv';

// ============================================================
// Strong import planning + execution (issue #100)
// ============================================================
// buildStrongImportPlan is pure: it groups parsed rows into sessions, matches
// exercises case-insensitively against the user's catalog, and skips exact
// duplicates. executeStrongImport performs the writes through the transaction
// client it is given, so the route can wrap one import in one transaction and
// a failure rolls everything back.

export interface PlannedSet {
  exerciseName: string;
  setOrder: number;
  weightKg: number;
  reps: number;
}

export interface PlannedSession {
  dateKey: string; // YYYY-MM-DD
  workoutName: string;
  sets: PlannedSet[];
}

export interface StrongImportPlan {
  sessions: PlannedSession[];
  // New exercise names to create (original casing of first occurrence),
  // sorted.
  newExerciseNames: string[];
  totalSets: number;
  // Exact duplicates (same day, exercise, set order, weight, reps as an
  // existing set or an earlier row of this file), skipped.
  duplicateCount: number;
}

// Key for exact-duplicate detection.
export function setDuplicateKey(
  dateKey: string,
  exerciseName: string,
  setOrder: number,
  weightKg: number,
  reps: number,
): string {
  return `${dateKey}|${exerciseName.trim().toLowerCase()}|${setOrder}|${weightKg}|${reps}`;
}

export function buildStrongImportPlan(
  rows: StrongCsvRow[],
  existingExerciseNames: string[],
  existingSetKeys: ReadonlySet<string>,
): StrongImportPlan {
  const known = new Set(existingExerciseNames.map((n) => n.trim().toLowerCase()));
  const newByLower = new Map<string, string>();
  const sessionsByKey = new Map<string, PlannedSession>();
  const seenKeys = new Set<string>(existingSetKeys);
  let totalSets = 0;
  let duplicateCount = 0;

  for (const row of rows) {
    const dupKey = setDuplicateKey(
      row.dateKey,
      row.exerciseName,
      row.setOrder,
      row.weightKg,
      row.reps,
    );
    if (seenKeys.has(dupKey)) {
      duplicateCount++;
      continue;
    }
    seenKeys.add(dupKey);

    const lower = row.exerciseName.trim().toLowerCase();
    if (!known.has(lower) && !newByLower.has(lower)) {
      newByLower.set(lower, row.exerciseName.trim());
    }

    const sessionKey = `${row.dateKey}|${row.workoutName}`;
    let session = sessionsByKey.get(sessionKey);
    if (!session) {
      session = { dateKey: row.dateKey, workoutName: row.workoutName, sets: [] };
      sessionsByKey.set(sessionKey, session);
    }
    session.sets.push({
      exerciseName: row.exerciseName,
      setOrder: row.setOrder,
      weightKg: row.weightKg,
      reps: row.reps,
    });
    totalSets++;
  }

  const sessions = [...sessionsByKey.values()].sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey),
  );
  for (const s of sessions) {
    s.sets.sort(
      (a, b) =>
        a.exerciseName.localeCompare(b.exerciseName) || a.setOrder - b.setOrder,
    );
  }

  return {
    sessions,
    newExerciseNames: [...newByLower.values()].sort((a, b) => a.localeCompare(b)),
    totalSets,
    duplicateCount,
  };
}

// Honest default: Strong's export has no start/end times, so the session is
// pinned to noon UTC of its day.
export function sessionDateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export interface StrongImportResult {
  createdSessions: number;
  createdSets: number;
  createdExercises: number;
}

type Db = PrismaClient | Prisma.TransactionClient;

// Performs the writes for a plan through the given client. Call it inside
// db.$transaction so a mid-import failure rolls back every row.
export async function executeStrongImport(
  tx: Db,
  userId: string,
  plan: StrongImportPlan,
): Promise<StrongImportResult> {
  // Resolve the user's exercises case-insensitively, creating the missing
  // ones (OTHER / ISOLATION; the user can re-categorize later).
  const existing = await tx.exercise.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const idByLower = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e.id]));

  let createdExercises = 0;
  for (const name of plan.newExerciseNames) {
    const lower = name.trim().toLowerCase();
    if (idByLower.has(lower)) continue;
    const created = await tx.exercise.create({
      data: {
        userId,
        name,
        muscleGroup: 'OTHER',
        category: 'ISOLATION',
        notes: 'Imported from Strong. Adjust the muscle group and category.',
      },
    });
    idByLower.set(lower, created.id);
    createdExercises++;
  }

  let createdSessions = 0;
  let createdSets = 0;
  for (const session of plan.sessions) {
    if (session.sets.length === 0) continue;
    const startedAt = sessionDateFromKey(session.dateKey);
    const created = await tx.session.create({
      data: {
        userId,
        startedAt,
        finishedAt: startedAt,
        notes: `Imported from Strong - ${session.workoutName}`,
      },
    });
    createdSessions++;

    await tx.set.createMany({
      data: session.sets.map((s) => {
        const exerciseId = idByLower.get(s.exerciseName.trim().toLowerCase());
        if (!exerciseId) {
          // Cannot happen for a plan built by buildStrongImportPlan; guards
          // against a malformed plan reaching the DB.
          throw new Error(`Unresolved exercise: ${s.exerciseName}`);
        }
        return {
          sessionId: created.id,
          exerciseId,
          setNumber: s.setOrder,
          weight: s.weightKg,
          reps: s.reps,
          completedAt: startedAt,
        };
      }),
    });
    createdSets += session.sets.length;
  }

  return { createdSessions, createdSets, createdExercises };
}
