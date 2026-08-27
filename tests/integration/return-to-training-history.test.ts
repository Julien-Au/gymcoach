import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { getReturnToTrainingRecommendations } from '@/lib/return-to-training-history';
import { RETURN_LONG_TERM_ANCHOR_SESSION_LIMIT } from '@/lib/return-to-training';

const now = new Date('2026-07-12T12:00:00.000Z');

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

function finishedAt(days: number): Date {
  return new Date(daysAgo(days).getTime() + 60 * 60_000);
}

describe('return-to-training history builder', () => {
  it('separates a stale exercise from a recently trained primary muscle', async () => {
    const user = await db.user.create({
      data: {
        email: 'return-history-' + Date.now() + '@test.dev',
        passwordHash: 'x',
        bodyweight: 80,
      },
    });
    const dumbbellPress = await db.exercise.create({
      data: {
        userId: user.id,
        name: 'Incline Dumbbell Press',
        muscleGroup: 'CHEST',
        category: 'COMPOUND',
        equipmentType: 'DUMBBELL',
      },
    });
    const barbellPress = await db.exercise.create({
      data: {
        userId: user.id,
        name: 'Barbell Bench Press',
        muscleGroup: 'CHEST',
        category: 'COMPOUND',
        equipmentType: 'BARBELL',
      },
    });

    for (const [index, age] of [60, 70, 80].entries()) {
      const session = await db.session.create({
        data: { userId: user.id, startedAt: daysAgo(age), finishedAt: finishedAt(age) },
      });
      await db.set.create({
        data: {
          sessionId: session.id,
          exerciseId: dumbbellPress.id,
          setNumber: index + 1,
          weight: 20,
          reps: 10,
          rir: 2,
          completedAt: daysAgo(age),
        },
      });
    }

    for (const age of [5, 8, 35, 42]) {
      const session = await db.session.create({
        data: { userId: user.id, startedAt: daysAgo(age), finishedAt: finishedAt(age) },
      });
      await db.set.createMany({
        data: [1, 2].map((setNumber) => ({
          sessionId: session.id,
          exerciseId: barbellPress.id,
          setNumber,
          weight: 80,
          reps: 8,
          rir: 2,
          completedAt: daysAgo(age),
        })),
      });
    }

    const current = await db.session.create({
      data: { userId: user.id, startedAt: now },
    });
    await db.set.create({
      data: {
        sessionId: current.id,
        exerciseId: dumbbellPress.id,
        setNumber: 1,
        weight: 40,
        reps: 5,
        rir: 0,
        completedAt: daysAgo(1),
      },
    });

    const recommendations = await getReturnToTrainingRecommendations({
      userId: user.id,
      programExercises: [
        {
          id: 'pe-return',
          exerciseId: dumbbellPress.id,
          targetSets: 4,
          targetRepsMin: 8,
          targetRIR: 2,
          exercise: dumbbellPress,
        },
      ],
      excludeSessionId: current.id,
      now,
      bodyweight: user.bodyweight,
      gym: {
        dumbbellWeights: [10, 12, 14, 15, 16, 19],
        plateWeights: [1.25, 2.5, 5, 10, 20],
        barWeights: [20],
        exerciseConfigs: [],
      },
    });

    expect(recommendations['pe-return']).toMatchObject({
      mode: 'exercise-reintro',
      exerciseGapDays: 60,
      muscleGapDays: 5,
      muscleMaintained: true,
      targetSets: 2,
      targetRIR: 3,
      weightCeiling: 19,
      suggestedWeight: 16,
      historySessionCount: 3,
    });
  });

  it('caps detailed history and ignores unfinished prior sessions', async () => {
    const user = await db.user.create({
      data: { email: 'return-history-bounded-' + Date.now() + '@test.dev', passwordHash: 'x' },
    });
    const exercise = await db.exercise.create({
      data: {
        userId: user.id,
        name: 'Bounded History Row',
        muscleGroup: 'BACK_THICKNESS',
        category: 'COMPOUND',
        equipmentType: 'CABLE',
      },
    });

    for (let index = 0; index < RETURN_LONG_TERM_ANCHOR_SESSION_LIMIT + 4; index += 1) {
      const age = 50 + index;
      const session = await db.session.create({
        data: { userId: user.id, startedAt: daysAgo(age), finishedAt: finishedAt(age) },
      });
      await db.set.create({
        data: {
          sessionId: session.id,
          exerciseId: exercise.id,
          setNumber: 1,
          weight: 50 + index,
          reps: 8,
          rir: 2,
          completedAt: daysAgo(age),
        },
      });
    }

    const abandonedSession = await db.session.create({
      data: { userId: user.id, startedAt: daysAgo(1), finishedAt: null },
    });
    await db.set.create({
      data: {
        sessionId: abandonedSession.id,
        exerciseId: exercise.id,
        setNumber: 1,
        weight: 999,
        reps: 1,
        rir: 0,
        completedAt: daysAgo(1),
      },
    });

    const recommendations = await getReturnToTrainingRecommendations({
      userId: user.id,
      programExercises: [
        {
          id: 'pe-bounded',
          exerciseId: exercise.id,
          targetSets: 4,
          targetRepsMin: 8,
          targetRIR: 2,
          exercise,
        },
      ],
      excludeSessionId: null,
      now,
    });

    expect(recommendations['pe-bounded']).toMatchObject({
      exerciseGapDays: 50,
      muscleGapDays: 50,
      mode: 'muscle-reintro',
      historySessionCount: RETURN_LONG_TERM_ANCHOR_SESSION_LIMIT,
    });
  });
});
