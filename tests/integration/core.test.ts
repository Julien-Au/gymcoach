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
