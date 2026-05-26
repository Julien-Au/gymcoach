import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

// ============================================================
// Backup / Import JSON (LOT 11)
// ============================================================
// The export covers all entities tied to the user (programs, workouts,
// exercises, sessions, sets, coach sessions). The import recreates the content
// for the current user by replacing the cuid ids with new ones, so it does not
// break uniqueness constraints or pollute another user.

const VERSION = 1;

// GET /api/backup: returns an exportable JSON.
export async function GET() {
  try {
    const userId = await requireApiUserId();

    const [user, programs, exercises, sessions, coachSessions] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { email: true, createdAt: true },
      }),
      db.program.findMany({
        where: { userId },
        include: {
          workouts: {
            orderBy: { order: 'asc' },
            include: {
              exercises: {
                orderBy: { order: 'asc' },
                include: { exercise: { select: { name: true } } },
              },
            },
          },
        },
      }),
      db.exercise.findMany({ where: { userId } }),
      db.session.findMany({
        where: { userId },
        orderBy: { startedAt: 'asc' },
        include: {
          sets: { orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }] },
        },
      }),
      db.coachSession.findMany({ where: { userId } }),
    ]);

    if (!user) throw new ApiError(404, 'User not found.');

    const dump = {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      user,
      exercises: exercises.map((e) => ({
        name: e.name,
        muscleGroup: e.muscleGroup,
        category: e.category,
        defaultRestSec: e.defaultRestSec,
        notes: e.notes,
      })),
      programs: programs.map((p) => ({
        name: p.name,
        description: p.description,
        phase: p.phase,
        isActive: p.isActive,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate?.toISOString() ?? null,
        workouts: p.workouts.map((w) => ({
          name: w.name,
          dayOfWeek: w.dayOfWeek,
          order: w.order,
          exercises: w.exercises.map((pe) => ({
            exerciseName: pe.exercise.name,
            order: pe.order,
            targetSets: pe.targetSets,
            targetRepsMin: pe.targetRepsMin,
            targetRepsMax: pe.targetRepsMax,
            targetRIR: pe.targetRIR,
            restSec: pe.restSec,
            tempo: pe.tempo,
            notes: pe.notes,
          })),
        })),
      })),
      sessions: sessions.map((s) => ({
        // Local identifier used to link the sets, not exported as-is.
        _localId: s.id,
        programName: programs.find((p) => p.id === s.programId)?.name ?? null,
        workoutName: programs
          .flatMap((p) => p.workouts)
          .find((w) => w.id === s.workoutId)?.name ?? null,
        startedAt: s.startedAt.toISOString(),
        finishedAt: s.finishedAt?.toISOString() ?? null,
        notes: s.notes,
        sets: s.sets.map((set) => ({
          exerciseName: exercises.find((e) => e.id === set.exerciseId)?.name ?? null,
          setNumber: set.setNumber,
          weight: set.weight,
          reps: set.reps,
          rir: set.rir,
          notes: set.notes,
          isWarmup: set.isWarmup,
          isDropSet: set.isDropSet,
          completedAt: set.completedAt.toISOString(),
        })),
      })),
      coachSessions: coachSessions.map((c) => ({
        weekStart: c.weekStart.toISOString(),
        weekEnd: c.weekEnd.toISOString(),
        prompt: c.prompt,
        response: c.response,
        appliedAt: c.appliedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
    };

    const filename = `gymcoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(dump, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// ------------------------------------------------------------
// Import
// ------------------------------------------------------------

const importSchema = z.object({
  version: z.number().int().min(1).max(VERSION),
  exercises: z.array(
    z.object({
      name: z.string().trim().min(1).max(120),
      muscleGroup: z.string(),
      category: z.string(),
      defaultRestSec: z.number().int().min(15).max(600),
      notes: z.string().nullable().optional(),
    }),
  ),
  programs: z.array(
    z.object({
      name: z.string().trim().min(1).max(200),
      description: z.string().nullable().optional(),
      phase: z.string(),
      isActive: z.boolean(),
      startDate: z.string(),
      endDate: z.string().nullable().optional(),
      workouts: z.array(
        z.object({
          name: z.string().trim().min(1).max(200),
          dayOfWeek: z.number().int().min(1).max(7).nullable().optional(),
          order: z.number().int(),
          exercises: z.array(
            z.object({
              exerciseName: z.string(),
              order: z.number().int(),
              targetSets: z.number().int().min(1).max(20),
              targetRepsMin: z.number().int().min(1).max(50),
              targetRepsMax: z.number().int().min(1).max(50),
              targetRIR: z.number().int().min(0).max(5),
              restSec: z.number().int().min(15).max(600),
              tempo: z.string().nullable().optional(),
              notes: z.string().nullable().optional(),
            }),
          ),
        }),
      ),
    }),
  ),
  sessions: z.array(
    z.object({
      programName: z.string().nullable().optional(),
      workoutName: z.string().nullable().optional(),
      startedAt: z.string(),
      finishedAt: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      sets: z.array(
        z.object({
          exerciseName: z.string().nullable(),
          setNumber: z.number().int().min(1),
          weight: z.number().min(0),
          reps: z.number().int().min(0),
          rir: z.number().int().nullable().optional(),
          notes: z.string().nullable().optional(),
          isWarmup: z.boolean(),
          isDropSet: z.boolean(),
          completedAt: z.string(),
        }),
      ),
    }),
  ),
  coachSessions: z
    .array(
      z.object({
        weekStart: z.string(),
        weekEnd: z.string(),
        prompt: z.string(),
        response: z.string(),
        appliedAt: z.string().nullable().optional(),
        createdAt: z.string(),
      }),
    )
    .optional(),
});

const importBodySchema = z.object({
  payload: importSchema,
  // Explicit confirmation: replaces all data of the current user.
  confirmReplace: z.literal(true),
});

// POST /api/backup: clears the current user's data and recreates it from the
// payload. Atomic: everything runs in a Prisma transaction.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const { payload } = await parseJsonBody(req, importBodySchema);

    await db.$transaction(
      async (tx) => {
        // 1. Purge the user's existing data (sets via cascade then sessions,
        //    coach sessions, programs/workouts/program-exercises via cascade,
        //    exercises).
        await tx.set.deleteMany({ where: { session: { userId } } });
        await tx.session.deleteMany({ where: { userId } });
        await tx.coachSession.deleteMany({ where: { userId } });
        // workouts/programExercises cascade via Program.
        await tx.program.deleteMany({ where: { userId } });
        await tx.exercise.deleteMany({ where: { userId } });

        // 2. Recreate the exercises; we keep a name -> id index to link them.
        const exerciseIdByName = new Map<string, string>();
        for (const e of payload.exercises) {
          const created = await tx.exercise.create({
            data: {
              userId,
              name: e.name,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              muscleGroup: e.muscleGroup as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              category: e.category as any,
              defaultRestSec: e.defaultRestSec,
              notes: e.notes ?? null,
            },
          });
          exerciseIdByName.set(e.name, created.id);
        }

        // 3. Recreate programs / workouts / programExercises.
        for (const p of payload.programs) {
          const program = await tx.program.create({
            data: {
              userId,
              name: p.name,
              description: p.description ?? null,
              phase: p.phase,
              isActive: p.isActive,
              startDate: new Date(p.startDate),
              endDate: p.endDate ? new Date(p.endDate) : null,
            },
          });
          for (const w of p.workouts) {
            const workout = await tx.workout.create({
              data: {
                programId: program.id,
                name: w.name,
                dayOfWeek: w.dayOfWeek ?? null,
                order: w.order,
              },
            });
            for (const pe of w.exercises) {
              const exId = exerciseIdByName.get(pe.exerciseName);
              if (!exId) continue;
              await tx.programExercise.create({
                data: {
                  workoutId: workout.id,
                  exerciseId: exId,
                  order: pe.order,
                  targetSets: pe.targetSets,
                  targetRepsMin: pe.targetRepsMin,
                  targetRepsMax: pe.targetRepsMax,
                  targetRIR: pe.targetRIR,
                  restSec: pe.restSec,
                  tempo: pe.tempo ?? null,
                  notes: pe.notes ?? null,
                },
              });
            }
          }
        }

        // 4. Sessions + sets: we try to link to the program/workout by name,
        //    but accept leaving them nullable if not found.
        const programs = await tx.program.findMany({
          where: { userId },
          include: { workouts: true },
        });
        const programByName = new Map(programs.map((p) => [p.name, p]));

        for (const s of payload.sessions) {
          const program = s.programName ? programByName.get(s.programName) : null;
          const workout = s.workoutName
            ? program?.workouts.find((w) => w.name === s.workoutName)
            : null;
          const session = await tx.session.create({
            data: {
              userId,
              programId: program?.id ?? null,
              workoutId: workout?.id ?? null,
              startedAt: new Date(s.startedAt),
              finishedAt: s.finishedAt ? new Date(s.finishedAt) : null,
              notes: s.notes ?? null,
            },
          });
          for (const set of s.sets) {
            const exId = set.exerciseName
              ? exerciseIdByName.get(set.exerciseName)
              : undefined;
            if (!exId) continue;
            await tx.set.create({
              data: {
                sessionId: session.id,
                exerciseId: exId,
                setNumber: set.setNumber,
                weight: set.weight,
                reps: set.reps,
                rir: set.rir ?? null,
                notes: set.notes ?? null,
                isWarmup: set.isWarmup,
                isDropSet: set.isDropSet,
                completedAt: new Date(set.completedAt),
              },
            });
          }
        }

        for (const c of payload.coachSessions ?? []) {
          await tx.coachSession.create({
            data: {
              userId,
              weekStart: new Date(c.weekStart),
              weekEnd: new Date(c.weekEnd),
              prompt: c.prompt,
              response: c.response,
              appliedAt: c.appliedAt ? new Date(c.appliedAt) : null,
              createdAt: new Date(c.createdAt),
            },
          });
        }
      },
      { timeout: 30_000 },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
