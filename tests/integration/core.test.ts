import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { seedExerciseCatalog, EXERCISE_CATALOG } from '@/lib/exercise-catalog';
import { buildProgramFromGenerated } from '@/lib/program-generation';
import type { GeneratedProgram } from '@/lib/schemas/program-generation';
import { buildCoachPayload } from '@/lib/coach';
import { programTemplates, getTemplateBySlug } from '@/lib/programs/templates';

async function makeUser(email: string) {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

describe('seedExerciseCatalog', () => {
  it('seeds the full catalog and is idempotent', async () => {
    const user = await makeUser('seed@test.dev');

    const first = await seedExerciseCatalog(db, user.id);
    expect(first.size).toBe(EXERCISE_CATALOG.length);

    const count1 = await db.exercise.count({ where: { userId: user.id } });
    expect(count1).toBe(EXERCISE_CATALOG.length);

    // Running again must not create duplicates (upsert on userId+name).
    await seedExerciseCatalog(db, user.id);
    const count2 = await db.exercise.count({ where: { userId: user.id } });
    expect(count2).toBe(EXERCISE_CATALOG.length);
  });
});

describe('buildProgramFromGenerated', () => {
  it('persists the program, reuses existing exercises and creates new ones', async () => {
    const user = await makeUser('build@test.dev');
    await seedExerciseCatalog(db, user.id);
    const before = await db.exercise.count({ where: { userId: user.id } });

    const generated: GeneratedProgram = {
      name: 'Test PPL',
      description: 'desc',
      phase: 'Hypertrophy',
      workouts: [
        {
          name: 'Push',
          dayOfWeek: 1,
          exercises: [
            {
              // existing catalog name -> reused
              name: 'Barbell bench press',
              muscleGroup: 'CHEST',
              category: 'COMPOUND',
              targetSets: 4,
              targetRepsMin: 6,
              targetRepsMax: 10,
              targetRIR: 2,
              restSec: 120,
            },
            {
              // brand-new exercise -> created
              name: 'Brand New Cable Thing',
              muscleGroup: 'SHOULDERS_LATERAL',
              category: 'ISOLATION',
              targetSets: 3,
              targetRepsMin: 12,
              targetRepsMax: 15,
              targetRIR: 1,
              restSec: 60,
            },
          ],
        },
      ],
    };

    const programId = await buildProgramFromGenerated(user.id, generated);

    const program = await db.program.findUnique({
      where: { id: programId },
      include: { workouts: { include: { exercises: { include: { exercise: true } } } } },
    });
    expect(program?.userId).toBe(user.id);
    expect(program?.isActive).toBe(false);
    expect(program?.workouts).toHaveLength(1);
    expect(program?.workouts[0]?.exercises).toHaveLength(2);

    // Exactly one new exercise was created.
    const after = await db.exercise.count({ where: { userId: user.id } });
    expect(after).toBe(before + 1);

    const names = program?.workouts[0]?.exercises.map((pe) => pe.exercise.name).sort();
    expect(names).toEqual(['Barbell bench press', 'Brand New Cable Thing']);
  });
});

describe('built-in program templates materialize into a Program', () => {
  it('persists every template as a runnable program for the user', async () => {
    const user = await makeUser('templates@test.dev');

    for (const template of programTemplates) {
      const programId = await buildProgramFromGenerated(user.id, template.program);
      const program = await db.program.findUnique({
        where: { id: programId },
        include: { workouts: { include: { exercises: true } } },
      });

      expect(program?.userId).toBe(user.id);
      // Materialized as inactive, like any generated program.
      expect(program?.isActive).toBe(false);
      expect(program?.name).toBe(template.program.name);
      expect(program?.workouts).toHaveLength(template.program.workouts.length);

      // Every workout has its exercises with the template's targets.
      for (const w of template.program.workouts) {
        const persistedWorkout = program?.workouts.find((pw) => pw.name === w.name);
        expect(persistedWorkout?.exercises).toHaveLength(w.exercises.length);
      }
    }
  });

  it('can run a session from a template-instantiated program', async () => {
    const user = await makeUser('template-session@test.dev');
    const template = getTemplateBySlug('upper-lower-4day');
    expect(template).toBeDefined();

    const programId = await buildProgramFromGenerated(user.id, template!.program);
    const program = await db.program.findUnique({
      where: { id: programId },
      include: { workouts: { include: { exercises: true } } },
    });
    const firstWorkout = program!.workouts[0]!;

    const session = await db.session.create({
      data: { userId: user.id, programId, workoutId: firstWorkout.id },
    });
    const firstExercise = firstWorkout.exercises[0]!;
    const set = await db.set.create({
      data: {
        sessionId: session.id,
        exerciseId: firstExercise.exerciseId,
        weight: 60,
        reps: 8,
        setNumber: 1,
      },
    });

    expect(set.sessionId).toBe(session.id);
    const sessionWithSets = await db.session.findUnique({
      where: { id: session.id },
      include: { sets: true },
    });
    expect(sessionWithSets?.sets).toHaveLength(1);
  });
});

describe('buildCoachPayload isolation', () => {
  it('only includes the requesting user data', async () => {
    const userA = await makeUser('a@test.dev');
    const userB = await makeUser('b@test.dev');

    const exA = await db.exercise.create({
      data: {
        userId: userA.id,
        name: 'A-Only Bench',
        muscleGroup: 'CHEST',
        category: 'COMPOUND',
      },
    });
    const exB = await db.exercise.create({
      data: {
        userId: userB.id,
        name: 'B-Only Squat',
        muscleGroup: 'QUADS',
        category: 'COMPOUND',
      },
    });

    const sessionA = await db.session.create({ data: { userId: userA.id } });
    await db.set.create({
      data: { sessionId: sessionA.id, exerciseId: exA.id, setNumber: 1, weight: 60, reps: 8 },
    });

    const sessionB = await db.session.create({ data: { userId: userB.id } });
    await db.set.create({
      data: { sessionId: sessionB.id, exerciseId: exB.id, setNumber: 1, weight: 100, reps: 5 },
    });

    const payload = await buildCoachPayload(userA.id);
    const names = payload.recentProgress.map((p) => p.exerciseName);
    expect(names).toContain('A-Only Bench');
    expect(names).not.toContain('B-Only Squat');
  });
});

describe('buildCoachPayload cardio exclusion (issue #140)', () => {
  it('keeps cardio sets out of the week summary and workingSetCount', async () => {
    const user = await makeUser('cardio-coach@test.dev');
    const bench = await db.exercise.create({
      data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    const run = await db.exercise.create({
      data: { userId: user.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
    });

    const session = await db.session.create({ data: { userId: user.id } });
    await db.set.create({
      data: { sessionId: session.id, exerciseId: bench.id, setNumber: 1, weight: 80, reps: 8 },
    });
    await db.set.create({
      data: { sessionId: session.id, exerciseId: bench.id, setNumber: 2, weight: 40, reps: 10, isWarmup: true },
    });
    await db.set.create({
      data: {
        sessionId: session.id,
        exerciseId: run.id,
        setNumber: 1,
        weight: 0,
        reps: 1,
        durationSec: 1800,
        distanceM: 5000,
      },
    });

    const payload = await buildCoachPayload(user.id);
    const week = payload.weekCurrent.sessions.find((s) => s.sessionId === session.id);
    expect(week).toBeDefined();
    // Only the strength working set counts; the cardio set is not a lift.
    expect(week?.workingSetCount).toBe(1);
    const exerciseNames = week?.exercises.map((e) => e.exerciseName) ?? [];
    expect(exerciseNames).toContain('Bench');
    expect(exerciseNames).not.toContain('Running');
  });
});

describe('buildCoachPayload readiness (issue #38)', () => {
  it('surfaces the latest recent readiness check-in into the payload', async () => {
    const user = await makeUser('readiness@test.dev');

    // An older check-in and a newer one: the newest should win.
    await db.readinessCheckin.create({
      data: {
        userId: user.id,
        readiness: 2,
        sleepQuality: 2,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    });
    await db.readinessCheckin.create({
      data: {
        userId: user.id,
        readiness: 4,
        sleepQuality: 5,
        soreness: { QUADS: 5, CHEST: 2 },
        note: 'legs sore',
      },
    });

    const payload = await buildCoachPayload(user.id);
    expect(payload.latestReadiness).not.toBeNull();
    expect(payload.latestReadiness?.readiness).toBe(4);
    expect(payload.latestReadiness?.sleepQuality).toBe(5);
    expect(payload.latestReadiness?.soreness).toEqual({ QUADS: 5, CHEST: 2 });
    expect(payload.latestReadiness?.note).toBe('legs sore');
  });

  it('ignores a stale check-in older than 7 days', async () => {
    const user = await makeUser('stale-readiness@test.dev');
    await db.readinessCheckin.create({
      data: {
        userId: user.id,
        readiness: 3,
        sleepQuality: 3,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });

    const payload = await buildCoachPayload(user.id);
    expect(payload.latestReadiness).toBeNull();
  });

  it('does not leak another user check-in', async () => {
    const userA = await makeUser('ra@test.dev');
    const userB = await makeUser('rb@test.dev');
    await db.readinessCheckin.create({
      data: { userId: userB.id, readiness: 5, sleepQuality: 5 },
    });

    const payload = await buildCoachPayload(userA.id);
    expect(payload.latestReadiness).toBeNull();
  });

  it('is null when the user never checked in', async () => {
    const user = await makeUser('no-readiness@test.dev');
    const payload = await buildCoachPayload(user.id);
    expect(payload.latestReadiness).toBeNull();
  });
});

describe('buildCoachPayload goals (issue #101)', () => {
  it('surfaces each goal with e1RM progress and achievement', async () => {
    const user = await makeUser('goals-payload@test.dev');
    const bench = await db.exercise.create({
      data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    const session = await db.session.create({ data: { userId: user.id } });
    await db.set.create({
      data: { sessionId: session.id, exerciseId: bench.id, setNumber: 1, weight: 100, reps: 5 },
    });
    // Unachieved 120x5 target: best e1RM 116.7 vs target e1RM 140 -> 83%.
    await db.exerciseGoal.create({
      data: { userId: user.id, exerciseId: bench.id, targetWeight: 120, targetReps: 5 },
    });

    const payload = await buildCoachPayload(user.id);
    expect(payload.goals).toEqual([
      {
        exerciseName: 'Bench',
        targetWeight: 120,
        targetReps: 5,
        progressPct: 83,
        achieved: false,
      },
    ]);
  });

  it('marks an achieved goal and caps progress at 100', async () => {
    const user = await makeUser('goals-achieved@test.dev');
    const bench = await db.exercise.create({
      data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    const session = await db.session.create({ data: { userId: user.id } });
    await db.set.create({
      data: { sessionId: session.id, exerciseId: bench.id, setNumber: 1, weight: 100, reps: 5 },
    });
    await db.exerciseGoal.create({
      data: {
        userId: user.id,
        exerciseId: bench.id,
        targetWeight: 90,
        targetReps: 5,
        achievedAt: new Date(),
      },
    });

    const payload = await buildCoachPayload(user.id);
    expect(payload.goals[0]?.achieved).toBe(true);
    expect(payload.goals[0]?.progressPct).toBe(100);
  });

  it('uses the effective load for bodyweight exercises', async () => {
    const user = await db.user.create({
      data: { email: 'goals-bw@test.dev', passwordHash: 'x', bodyweight: 80 },
    });
    const pullups = await db.exercise.create({
      data: {
        userId: user.id,
        name: 'Pull-up',
        muscleGroup: 'BACK_WIDTH',
        category: 'COMPOUND',
        usesBodyweight: true,
      },
    });
    const session = await db.session.create({ data: { userId: user.id } });
    // +20 added at bodyweight 80 = 100 effective; target 100x5 effective.
    await db.set.create({
      data: { sessionId: session.id, exerciseId: pullups.id, setNumber: 1, weight: 20, reps: 5 },
    });
    await db.exerciseGoal.create({
      data: { userId: user.id, exerciseId: pullups.id, targetWeight: 100, targetReps: 5 },
    });

    const payload = await buildCoachPayload(user.id);
    expect(payload.goals[0]?.progressPct).toBe(100);
  });

  it("does not leak another user's goals and is empty without goals", async () => {
    const userA = await makeUser('goals-a@test.dev');
    const userB = await makeUser('goals-b@test.dev');
    const benchB = await db.exercise.create({
      data: { userId: userB.id, name: 'B Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    await db.exerciseGoal.create({
      data: { userId: userB.id, exerciseId: benchB.id, targetWeight: 100, targetReps: 5 },
    });

    const payload = await buildCoachPayload(userA.id);
    expect(payload.goals).toEqual([]);
  });
});

describe('buildCoachPayload fatigue (issue #101)', () => {
  // Three sessions on distinct days with an identical top set: e1RM flat over
  // the full stall lookback -> isStalled flags the lift.
  async function seedStalledLift(userId: string, name: string) {
    const exercise = await db.exercise.create({
      data: { userId, name, muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    for (let i = 0; i < 3; i++) {
      const startedAt = new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000);
      const session = await db.session.create({
        data: { userId, startedAt, finishedAt: startedAt },
      });
      await db.set.create({
        data: {
          sessionId: session.id,
          exerciseId: exercise.id,
          setNumber: 1,
          weight: 100,
          reps: 5,
          completedAt: startedAt,
        },
      });
    }
    return exercise;
  }

  it('reports no fatigue for a fresh user', async () => {
    const user = await makeUser('fatigue-fresh@test.dev');
    const payload = await buildCoachPayload(user.id);
    expect(payload.fatigue).toEqual({
      stalledExercises: [],
      deloadRecommended: false,
      deloadReasons: [],
      deloadActive: false,
    });
  });

  // Issue #112: the planned deload week surfaces as an additive input flag.
  it('reports deloadActive while a planned deload week is running, and not after it expires', async () => {
    const user = await makeUser('fatigue-deload-active@test.dev');

    await db.user.update({
      where: { id: user.id },
      data: { deloadUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
    });
    expect((await buildCoachPayload(user.id)).fatigue.deloadActive).toBe(true);

    await db.user.update({
      where: { id: user.id },
      data: { deloadUntil: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    expect((await buildCoachPayload(user.id)).fatigue.deloadActive).toBe(false);
  });

  it('flags stalled lifts and recommends a deload at two stalls', async () => {
    const user = await makeUser('fatigue-stalls@test.dev');
    await seedStalledLift(user.id, 'Bench');
    await seedStalledLift(user.id, 'Squat');

    const payload = await buildCoachPayload(user.id);
    expect(payload.fatigue.stalledExercises).toEqual(['Bench', 'Squat']);
    expect(payload.fatigue.deloadRecommended).toBe(true);
    expect(payload.fatigue.deloadReasons).toEqual([
      '2 lifts have stalled: Bench, Squat.',
    ]);
  });

  it('does not recommend a deload on a single stalled lift', async () => {
    const user = await makeUser('fatigue-single@test.dev');
    await seedStalledLift(user.id, 'Bench');

    const payload = await buildCoachPayload(user.id);
    expect(payload.fatigue.stalledExercises).toEqual(['Bench']);
    expect(payload.fatigue.deloadRecommended).toBe(false);
  });

  it('recommends a deload on chronically low readiness', async () => {
    const user = await makeUser('fatigue-readiness@test.dev');
    for (let i = 0; i < 3; i++) {
      await db.readinessCheckin.create({
        data: {
          userId: user.id,
          readiness: 2,
          sleepQuality: 3,
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        },
      });
    }

    const payload = await buildCoachPayload(user.id);
    expect(payload.fatigue.deloadRecommended).toBe(true);
    expect(payload.fatigue.deloadReasons).toEqual([
      'Your readiness has averaged 2/5 over your last 3 check-ins.',
    ]);
  });

  it("does not count another user's stalls", async () => {
    const userA = await makeUser('fatigue-a@test.dev');
    const userB = await makeUser('fatigue-b@test.dev');
    await seedStalledLift(userB.id, 'B Bench');

    const payload = await buildCoachPayload(userA.id);
    expect(payload.fatigue.stalledExercises).toEqual([]);
  });
});
