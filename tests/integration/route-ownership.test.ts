import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
// Mock it so we can act as either user without real cookies/JWTs.
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { DELETE as deleteSet } from '@/app/api/sets/[id]/route';
import { PUT as putSession } from '@/app/api/sessions/[id]/route';
import { GET as getExercise } from '@/app/api/exercises/[id]/route';

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

// Seed two users; user A owns an exercise, a session, and a set.
async function seed() {
  const [a, b] = await Promise.all([
    db.user.create({ data: { email: 'owner@test.dev', passwordHash: 'x' } }),
    db.user.create({ data: { email: 'stranger@test.dev', passwordHash: 'x' } }),
  ]);
  const exercise = await db.exercise.create({
    data: { userId: a.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const session = await db.session.create({ data: { userId: a.id, notes: 'original' } });
  const set = await db.set.create({
    data: { sessionId: session.id, exerciseId: exercise.id, setNumber: 1, weight: 60, reps: 10 },
  });
  return { a, b, exercise, session, set };
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('route ownership: DELETE /api/sets/[id]', () => {
  it('lets the owner delete their set', async () => {
    const { a, set } = await seed();
    actAs(a.id);
    const res = await deleteSet(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: set.id },
    });
    expect(res.status).toBe(200);
    expect(await db.set.findUnique({ where: { id: set.id } })).toBeNull();
  });

  it("returns 404 and keeps the set when a stranger tries to delete it", async () => {
    const { b, set } = await seed();
    actAs(b.id);
    const res = await deleteSet(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: set.id },
    });
    expect(res.status).toBe(404);
    // The set must still exist - no cross-user deletion.
    expect(await db.set.findUnique({ where: { id: set.id } })).not.toBeNull();
  });
});

describe('route ownership: PUT /api/sessions/[id]', () => {
  it('lets the owner update their session', async () => {
    const { a, session } = await seed();
    actAs(a.id);
    const res = await putSession(jsonReq('PUT', { notes: 'mine' }), {
      params: { id: session.id },
    });
    expect(res.status).toBe(200);
    expect((await db.session.findUnique({ where: { id: session.id } }))?.notes).toBe('mine');
  });

  it("returns 404 and leaves the session untouched for a stranger", async () => {
    const { b, session } = await seed();
    actAs(b.id);
    const res = await putSession(jsonReq('PUT', { notes: 'hacked' }), {
      params: { id: session.id },
    });
    expect(res.status).toBe(404);
    expect((await db.session.findUnique({ where: { id: session.id } }))?.notes).toBe('original');
  });
});

describe('route ownership: GET /api/exercises/[id]', () => {
  it('lets the owner read their exercise', async () => {
    const { a, exercise } = await seed();
    actAs(a.id);
    const res = await getExercise(new Request('http://t/api'), { params: { id: exercise.id } });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(exercise.id);
  });

  it("returns 404 for a stranger reading someone else's exercise", async () => {
    const { b, exercise } = await seed();
    actAs(b.id);
    const res = await getExercise(new Request('http://t/api'), { params: { id: exercise.id } });
    expect(res.status).toBe(404);
  });
});
