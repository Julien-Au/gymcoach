import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Issue #379: POST /api/workouts/[id]/program-exercises used to accept an
// exerciseId the workout already contained. The in-session menu and the
// program editor prevent the duplicate client-side only, so a double submit or
// a direct API call created a second row for the same exercise. The live
// runner keys sets by exerciseId (a Set carries no ProgramExercise reference),
// so the two rows shared one set pool and each read the other's sets. Pinned
// here: the 409, that the refusal writes nothing, that a different exercise
// still goes through, and that the same exercise stays available in another
// workout of the same program.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as postProgramExercise } from '@/app/api/workouts/[id]/program-exercises/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function jsonReq(body: unknown): Request {
  return new Request('http://test.local/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const targets = {
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetRIR: 2,
  restSec: 90,
};

async function seed(email: string) {
  const user = await db.user.create({ data: { email, passwordHash: 'x' } });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const row = await db.exercise.create({
    data: { userId: user.id, name: 'Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND' },
  });
  const program = await db.program.create({
    data: { userId: user.id, name: 'P', phase: 'Base' },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Day A', order: 1 },
  });
  const otherWorkout = await db.workout.create({
    data: { programId: program.id, name: 'Day B', order: 2 },
  });
  return { user, bench, row, workout, otherWorkout };
}

function post(workoutId: string, body: unknown) {
  return postProgramExercise(jsonReq(body), { params: Promise.resolve({ id: workoutId }) });
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST program-exercises - duplicate refusal (issue #379)', () => {
  it('refuses an exercise already in the workout, and writes nothing', async () => {
    const { user, bench, workout } = await seed('duplicate-refused@test.dev');
    actAs(user.id);

    const first = await post(workout.id, { exerciseId: bench.id, ...targets });
    expect(first.status).toBe(201);

    const second = await post(workout.id, { exerciseId: bench.id, ...targets });
    expect(second.status).toBe(409);
    expect((await second.json()).error).toMatch(/already/i);

    // The refusal is not a write: a double submit leaves exactly one row.
    expect(await db.programExercise.count({ where: { workoutId: workout.id } })).toBe(1);
  });

  it('still adds a different exercise to the same workout', async () => {
    const { user, bench, row, workout } = await seed('duplicate-other@test.dev');
    actAs(user.id);

    expect((await post(workout.id, { exerciseId: bench.id, ...targets })).status).toBe(201);
    expect((await post(workout.id, { exerciseId: row.id, ...targets })).status).toBe(201);
    expect(await db.programExercise.count({ where: { workoutId: workout.id } })).toBe(2);
  });

  it('keeps the exercise available in another workout of the same program', async () => {
    const { user, bench, workout, otherWorkout } = await seed('duplicate-other-workout@test.dev');
    actAs(user.id);

    expect((await post(workout.id, { exerciseId: bench.id, ...targets })).status).toBe(201);
    expect((await post(otherWorkout.id, { exerciseId: bench.id, ...targets })).status).toBe(201);
    expect(await db.programExercise.count({ where: { exerciseId: bench.id } })).toBe(2);
  });

  it('does not leak the duplicate check across users', async () => {
    const { user, bench, workout } = await seed('duplicate-owner@test.dev');
    const stranger = await db.user.create({
      data: { email: 'duplicate-stranger@test.dev', passwordHash: 'x' },
    });
    actAs(user.id);
    expect((await post(workout.id, { exerciseId: bench.id, ...targets })).status).toBe(201);

    // The stranger cannot reach the workout at all, and cannot reuse the id.
    actAs(stranger.id);
    const res = await post(workout.id, { exerciseId: bench.id, ...targets });
    expect(res.status).toBe(404);
    expect(await db.programExercise.count({ where: { workoutId: workout.id } })).toBe(1);
  });
});
