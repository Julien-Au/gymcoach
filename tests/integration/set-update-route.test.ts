import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// PATCH /api/sets/[id] (inline set editing) mirrors the guards the create route
// enforces: no edits inside a finished session, no strength values on a cardio
// set, and goal re-derivation that may newly stamp achievedAt on an edit while
// a delete only ever clears or re-stamps an already achieved goal.

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { PATCH as patchSet, DELETE as deleteSet } from '@/app/api/sets/[id]/route';

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

function idParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function seedUser() {
  return db.user.create({ data: { email: 'editor@test.dev', passwordHash: 'x' } });
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('PATCH /api/sets/[id] - guards mirrored from the create route', () => {
  it('refuses to edit a set once its session is finished and keeps the values', async () => {
    const user = await seedUser();
    const bench = await db.exercise.create({
      data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    const session = await db.session.create({
      data: { userId: user.id, finishedAt: new Date() },
    });
    const set = await db.set.create({
      data: { sessionId: session.id, exerciseId: bench.id, setNumber: 1, weight: 100, reps: 5 },
    });
    actAs(user.id);

    const res = await patchSet(
      jsonReq('PATCH', { weight: 110, reps: 5, rir: 1 }),
      idParams(set.id),
    );
    expect(res.status).toBe(400);
    const row = await db.set.findUnique({ where: { id: set.id } });
    expect(row).toMatchObject({ weight: 100, reps: 5, rir: null });
  });

  it('refuses strength values on a cardio set and keeps the normalized row', async () => {
    const user = await seedUser();
    const running = await db.exercise.create({
      data: { userId: user.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
    });
    const session = await db.session.create({ data: { userId: user.id } });
    const set = await db.set.create({
      data: {
        sessionId: session.id,
        exerciseId: running.id,
        setNumber: 1,
        weight: 0,
        reps: 1,
        durationSec: 750,
        distanceM: 2500,
      },
    });
    actAs(user.id);

    const res = await patchSet(
      jsonReq('PATCH', { weight: 50, reps: 8, rir: 2 }),
      idParams(set.id),
    );
    expect(res.status).toBe(400);
    const row = await db.set.findUnique({ where: { id: set.id } });
    expect(row).toMatchObject({ weight: 0, reps: 1, rir: null, durationSec: 750, distanceM: 2500 });
  });
});

describe('goal re-derivation after an edit or a delete', () => {
  // Two working sets, 100x5 and 110x5, and a goal of 110x5 created directly in
  // the database with achievedAt null, so the stamping decision is left to the
  // route under test rather than to goal creation.
  async function seedUnachievedGoal() {
    const user = await seedUser();
    const bench = await db.exercise.create({
      data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    const session = await db.session.create({ data: { userId: user.id } });
    const light = await db.set.create({
      data: { sessionId: session.id, exerciseId: bench.id, setNumber: 1, weight: 100, reps: 5 },
    });
    const heavy = await db.set.create({
      data: { sessionId: session.id, exerciseId: bench.id, setNumber: 2, weight: 110, reps: 5 },
    });
    const goal = await db.exerciseGoal.create({
      data: { userId: user.id, exerciseId: bench.id, targetWeight: 110, targetReps: 5 },
    });
    return { user, bench, session, light, heavy, goal };
  }

  it('stamps a previously unachieved goal when an edit makes a set meet the target', async () => {
    const { user, light, heavy, goal } = await seedUnachievedGoal();
    actAs(user.id);

    // Editing the light set upward to 110x5 is the newly achieving event. The
    // stamp lands on the earliest achieving set, which is this one (set 1).
    const res = await patchSet(
      jsonReq('PATCH', { weight: 110, reps: 5, rir: null }),
      idParams(light.id),
    );
    expect(res.status).toBe(200);
    const stamped = await db.exerciseGoal.findUnique({ where: { id: goal.id } });
    expect(stamped?.achievedAt).not.toBeNull();
    const achievers = await db.set.findMany({
      where: { id: { in: [light.id, heavy.id] } },
      orderBy: { completedAt: 'asc' },
    });
    expect(stamped?.achievedAt?.getTime()).toBe(achievers[0]?.completedAt.getTime());
  });

  it('never stamps an unachieved goal on delete, even when a remaining set meets the target', async () => {
    const { user, light, heavy, goal } = await seedUnachievedGoal();
    actAs(user.id);

    const res = await deleteSet(
      new Request('http://test.local/api', { method: 'DELETE' }),
      idParams(light.id),
    );
    expect(res.status).toBe(200);
    expect(await db.set.findUnique({ where: { id: light.id } })).toBeNull();
    expect(await db.set.findUnique({ where: { id: heavy.id } })).not.toBeNull();
    const untouched = await db.exerciseGoal.findUnique({ where: { id: goal.id } });
    expect(untouched?.achievedAt).toBeNull();
  });
});
