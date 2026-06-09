import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
// Mock it so we can act as a given user without real cookies/JWTs.
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET, POST } from '@/app/api/readiness/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function postReq(body: unknown): Request {
  return new Request('http://test.local/api/readiness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function makeUser(email: string) {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/readiness', () => {
  it('records a minimal check-in scoped to the authenticated user', async () => {
    const user = await makeUser('post-min@test.dev');
    actAs(user.id);

    const res = await POST(postReq({ readiness: 4, sleepQuality: 5 }));
    expect(res.status).toBe(201);

    expect(await db.readinessCheckin.count({ where: { userId: user.id } })).toBe(1);
    const checkin = await db.readinessCheckin.findFirstOrThrow({ where: { userId: user.id } });
    expect(checkin.readiness).toBe(4);
    expect(checkin.sleepQuality).toBe(5);
    expect(checkin.soreness).toBeNull();
    expect(checkin.note).toBeNull();
  });

  it('round-trips per-muscle-group soreness and a note', async () => {
    const user = await makeUser('post-full@test.dev');
    actAs(user.id);

    const res = await POST(
      postReq({
        readiness: 3,
        sleepQuality: 2,
        soreness: { CHEST: 4, QUADS: 5 },
        note: 'Legs are toast.',
      }),
    );
    expect(res.status).toBe(201);

    const created = await db.readinessCheckin.findFirstOrThrow({ where: { userId: user.id } });
    expect(created.soreness).toEqual({ CHEST: 4, QUADS: 5 });
    expect(created.note).toBe('Legs are toast.');
  });

  it('rejects an out-of-range rating with a 4xx and persists nothing', async () => {
    const user = await makeUser('post-bad-range@test.dev');
    actAs(user.id);

    const res = await POST(postReq({ readiness: 9, sleepQuality: 5 }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await db.readinessCheckin.count({ where: { userId: user.id } })).toBe(0);
  });

  it('rejects a body missing required fields with a 4xx and persists nothing', async () => {
    const user = await makeUser('post-missing@test.dev');
    actAs(user.id);

    const res = await POST(postReq({ readiness: 4 }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await db.readinessCheckin.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('GET /api/readiness', () => {
  it('returns null when the user has no check-in', async () => {
    const user = await makeUser('get-empty@test.dev');
    actAs(user.id);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('returns the most recent check-in for the user', async () => {
    const user = await makeUser('get-latest@test.dev');
    await db.readinessCheckin.create({
      data: {
        userId: user.id,
        readiness: 2,
        sleepQuality: 2,
        createdAt: new Date('2026-06-01T08:00:00Z'),
      },
    });
    await db.readinessCheckin.create({
      data: {
        userId: user.id,
        readiness: 5,
        sleepQuality: 4,
        createdAt: new Date('2026-06-08T08:00:00Z'),
      },
    });
    actAs(user.id);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.readiness).toBe(5);
    expect(body.sleepQuality).toBe(4);
  });

  it("returns the caller's own check-in, never another user's", async () => {
    const owner = await makeUser('get-owner@test.dev');
    const stranger = await makeUser('get-stranger@test.dev');
    // The owner's check-in is the more recent one, so a query that forgot to
    // scope by user would surface it instead of the stranger's.
    await db.readinessCheckin.create({
      data: {
        userId: stranger.id,
        readiness: 1,
        sleepQuality: 1,
        createdAt: new Date('2026-06-01T08:00:00Z'),
      },
    });
    await db.readinessCheckin.create({
      data: {
        userId: owner.id,
        readiness: 5,
        sleepQuality: 5,
        createdAt: new Date('2026-06-08T08:00:00Z'),
      },
    });

    actAs(stranger.id);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    // Must be the stranger's own row, not the owner's more recent one.
    expect(body.readiness).toBe(1);
  });
});
