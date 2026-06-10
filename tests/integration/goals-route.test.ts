import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
// Mock it so we can act as either user without real cookies/JWTs.
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as listGoals, POST as postGoal } from '@/app/api/goals/route';
import { DELETE as deleteGoal } from '@/app/api/goals/[id]/route';
import { POST as postSet } from '@/app/api/sessions/[id]/sets/route';
import { DELETE as deleteSet } from '@/app/api/sets/[id]/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function jsonReq(method: string, body: unknown): Request {
  return new Request('http://test.local/api', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Seed two users; user A owns an exercise with one logged set (100x5).
async function seed() {
  const [a, b] = await Promise.all([
    db.user.create({ data: { email: 'owner@test.dev', passwordHash: 'x' } }),
    db.user.create({ data: { email: 'stranger@test.dev', passwordHash: 'x' } }),
  ]);
  const exercise = await db.exercise.create({
    data: { userId: a.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const session = await db.session.create({ data: { userId: a.id } });
  const set = await db.set.create({
    data: { sessionId: session.id, exerciseId: exercise.id, setNumber: 1, weight: 100, reps: 5 },
  });
  return { a, b, exercise, session, set };
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/goals (create / upsert)', () => {
  it('creates a goal for the owner, unachieved when no set meets it', async () => {
    const { a, exercise } = await seed();
    actAs(a.id);
    const res = await postGoal(
      jsonReq('POST', { exerciseId: exercise.id, targetWeight: 120, targetReps: 5 }),
    );
    expect(res.status).toBe(201);
    const goal = await res.json();
    expect(goal.targetWeight).toBe(120);
    expect(goal.achievedAt).toBeNull();
  });

  it('stamps achievedAt at creation when a past set already beats the target', async () => {
    const { a, exercise, set } = await seed();
    actAs(a.id);
    const res = await postGoal(
      jsonReq('POST', { exerciseId: exercise.id, targetWeight: 95, targetReps: 5 }),
    );
    expect(res.status).toBe(201);
    const goal = await res.json();
    // Deterministic: stamped with the achieving set's completedAt.
    expect(new Date(goal.achievedAt).getTime()).toBe(set.completedAt.getTime());
  });

  it('replaces the existing goal (one per exercise) instead of adding another', async () => {
    const { a, exercise } = await seed();
    actAs(a.id);
    await postGoal(jsonReq('POST', { exerciseId: exercise.id, targetWeight: 95, targetReps: 5 }));
    const res = await postGoal(
      jsonReq('POST', { exerciseId: exercise.id, targetWeight: 140, targetReps: 3 }),
    );
    expect(res.status).toBe(201);
    const goals = await db.exerciseGoal.findMany({ where: { userId: a.id } });
    expect(goals).toHaveLength(1);
    expect(goals[0]?.targetWeight).toBe(140);
    // The heavier target is no longer met by the 100x5 set.
    expect(goals[0]?.achievedAt).toBeNull();
  });

  it("rejects a goal on another user's exercise", async () => {
    const { b, exercise } = await seed();
    actAs(b.id);
    const res = await postGoal(
      jsonReq('POST', { exerciseId: exercise.id, targetWeight: 100, targetReps: 5 }),
    );
    expect(res.status).toBe(404);
    expect(await db.exerciseGoal.count()).toBe(0);
  });

  it('rejects invalid input (Zod)', async () => {
    const { a, exercise } = await seed();
    actAs(a.id);
    const res = await postGoal(
      jsonReq('POST', { exerciseId: exercise.id, targetWeight: -10, targetReps: 5 }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/goals', () => {
  it("lists only the user's own goals", async () => {
    const { a, b, exercise } = await seed();
    actAs(a.id);
    await postGoal(jsonReq('POST', { exerciseId: exercise.id, targetWeight: 120, targetReps: 5 }));

    actAs(b.id);
    const res = await listGoals();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);

    actAs(a.id);
    const own = await (await listGoals()).json();
    expect(own).toHaveLength(1);
    expect(own[0].exercise.name).toBe('Bench');
  });
});

describe('DELETE /api/goals/[id]', () => {
  it('lets the owner delete their goal', async () => {
    const { a, exercise } = await seed();
    actAs(a.id);
    const goal = await (
      await postGoal(jsonReq('POST', { exerciseId: exercise.id, targetWeight: 120, targetReps: 5 }))
    ).json();
    const res = await deleteGoal(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: goal.id },
    });
    expect(res.status).toBe(200);
    expect(await db.exerciseGoal.count()).toBe(0);
  });

  it('returns 404 and keeps the goal when a stranger tries to delete it', async () => {
    const { a, b, exercise } = await seed();
    actAs(a.id);
    const goal = await (
      await postGoal(jsonReq('POST', { exerciseId: exercise.id, targetWeight: 120, targetReps: 5 }))
    ).json();
    actAs(b.id);
    const res = await deleteGoal(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: goal.id },
    });
    expect(res.status).toBe(404);
    expect(await db.exerciseGoal.count()).toBe(1);
  });
});

describe('goal achievement at set-save time', () => {
  it('stamps achievedAt when a newly logged working set meets the target', async () => {
    const { a, exercise, session } = await seed();
    actAs(a.id);
    await postGoal(jsonReq('POST', { exerciseId: exercise.id, targetWeight: 110, targetReps: 4 }));

    const res = await postSet(
      jsonReq('POST', { exerciseId: exercise.id, setNumber: 2, weight: 110, reps: 4 }),
      { params: { id: session.id } },
    );
    expect(res.status).toBe(201);
    const created = await res.json();

    const goal = await db.exerciseGoal.findFirst({ where: { userId: a.id } });
    expect(goal?.achievedAt?.getTime()).toBe(new Date(created.completedAt).getTime());
  });

  it('does not stamp on a warmup set or a set below the target', async () => {
    const { a, exercise, session } = await seed();
    actAs(a.id);
    await postGoal(jsonReq('POST', { exerciseId: exercise.id, targetWeight: 110, targetReps: 4 }));

    await postSet(
      jsonReq('POST', { exerciseId: exercise.id, setNumber: 2, weight: 110, reps: 4, isWarmup: true }),
      { params: { id: session.id } },
    );
    await postSet(
      jsonReq('POST', { exerciseId: exercise.id, setNumber: 3, weight: 105, reps: 4 }),
      { params: { id: session.id } },
    );

    const goal = await db.exerciseGoal.findFirst({ where: { userId: a.id } });
    expect(goal?.achievedAt).toBeNull();
  });

  it('uses the effective load for bodyweight exercises', async () => {
    const { a, session } = await seed();
    await db.user.update({ where: { id: a.id }, data: { bodyweight: 80 } });
    const pullups = await db.exercise.create({
      data: {
        userId: a.id,
        name: 'Pull-up',
        muscleGroup: 'BACK_WIDTH',
        category: 'COMPOUND',
        usesBodyweight: true,
      },
    });
    actAs(a.id);
    // Target: 100 kg effective x 5 (bodyweight 80 + 20 added).
    await postGoal(jsonReq('POST', { exerciseId: pullups.id, targetWeight: 100, targetReps: 5 }));

    // +15 added (95 effective): not achieved.
    await postSet(
      jsonReq('POST', { exerciseId: pullups.id, setNumber: 1, weight: 15, reps: 5 }),
      { params: { id: session.id } },
    );
    let goal = await db.exerciseGoal.findFirst({ where: { exerciseId: pullups.id } });
    expect(goal?.achievedAt).toBeNull();

    // +20 added (100 effective): achieved.
    await postSet(
      jsonReq('POST', { exerciseId: pullups.id, setNumber: 2, weight: 20, reps: 5 }),
      { params: { id: session.id } },
    );
    goal = await db.exerciseGoal.findFirst({ where: { exerciseId: pullups.id } });
    expect(goal?.achievedAt).not.toBeNull();
  });
});

describe('goal re-derivation when the achieving set is deleted (issue #96)', () => {
  it('clears achievedAt when no remaining set meets the target', async () => {
    const { a, exercise, set } = await seed();
    actAs(a.id);
    // The seeded 100x5 set already beats this target -> stamped at creation.
    await postGoal(jsonReq('POST', { exerciseId: exercise.id, targetWeight: 95, targetReps: 5 }));
    let goal = await db.exerciseGoal.findFirst({ where: { userId: a.id } });
    expect(goal?.achievedAt).not.toBeNull();

    const res = await deleteSet(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: set.id },
    });
    expect(res.status).toBe(200);
    goal = await db.exerciseGoal.findFirst({ where: { userId: a.id } });
    expect(goal?.achievedAt).toBeNull();
  });

  it('re-stamps with the earliest remaining achieving set', async () => {
    const { a, exercise, session, set } = await seed();
    actAs(a.id);
    await postGoal(jsonReq('POST', { exerciseId: exercise.id, targetWeight: 95, targetReps: 5 }));

    // A second, later set that also meets the target.
    const later = await (
      await postSet(
        jsonReq('POST', { exerciseId: exercise.id, setNumber: 2, weight: 97.5, reps: 5 }),
        { params: { id: session.id } },
      )
    ).json();

    // Deleting the original achieving set must move achievedAt to the
    // remaining one, not clear it and not keep the dead timestamp.
    await deleteSet(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: set.id },
    });
    const goal = await db.exerciseGoal.findFirst({ where: { userId: a.id } });
    expect(goal?.achievedAt?.getTime()).toBe(new Date(later.completedAt).getTime());
  });

  it('leaves an unachieved goal untouched when an unrelated set is deleted', async () => {
    const { a, exercise, set } = await seed();
    actAs(a.id);
    await postGoal(jsonReq('POST', { exerciseId: exercise.id, targetWeight: 120, targetReps: 5 }));

    const res = await deleteSet(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: set.id },
    });
    expect(res.status).toBe(200);
    const goal = await db.exerciseGoal.findFirst({ where: { userId: a.id } });
    expect(goal?.achievedAt).toBeNull();
  });
});
