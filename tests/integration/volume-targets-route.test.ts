import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import {
  GET as listTargets,
  POST as postTarget,
  DELETE as deleteTarget,
} from '@/app/api/volume-targets/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function jsonReq(method: string, body: unknown): Request {
  return new Request('http://test.local/api/volume-targets', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function seedUsers() {
  const [a, b] = await Promise.all([
    db.user.create({ data: { email: 'vt-owner@test.dev', passwordHash: 'x' } }),
    db.user.create({ data: { email: 'vt-stranger@test.dev', passwordHash: 'x' } }),
  ]);
  return { a, b };
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/volume-targets (issue #211)', () => {
  it('creates a target for the owner and upserts in place on a second post', async () => {
    const { a } = await seedUsers();
    actAs(a.id);

    const created = await postTarget(
      jsonReq('POST', { muscleGroup: 'CHEST', mev: 8, mrv: 18 }),
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ muscleGroup: 'CHEST', mev: 8, mrv: 18 });

    // Second post for the same group updates, never duplicates.
    const updated = await postTarget(
      jsonReq('POST', { muscleGroup: 'CHEST', mev: 10, mrv: 22 }),
    );
    expect(updated.status).toBe(201);
    const rows = await db.volumeTarget.findMany({ where: { userId: a.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ muscleGroup: 'CHEST', mev: 10, mrv: 22 });
  });

  it('rejects an invalid band (mrv <= mev) with 400 and stores nothing', async () => {
    const { a } = await seedUsers();
    actAs(a.id);
    const res = await postTarget(
      jsonReq('POST', { muscleGroup: 'CHEST', mev: 15, mrv: 10 }),
    );
    expect(res.status).toBe(400);
    expect(await db.volumeTarget.count({ where: { userId: a.id } })).toBe(0);
  });

  it('rejects an unauthenticated request with 401', async () => {
    mockUserId.mockResolvedValue(null);
    const res = await postTarget(
      jsonReq('POST', { muscleGroup: 'CHEST', mev: 8, mrv: 18 }),
    );
    expect(res.status).toBe(401);
  });
});

describe('GET /api/volume-targets', () => {
  it('returns only the requesting user targets', async () => {
    const { a, b } = await seedUsers();
    await db.volumeTarget.create({
      data: { userId: a.id, muscleGroup: 'CHEST', mev: 8, mrv: 18 },
    });
    await db.volumeTarget.create({
      data: { userId: b.id, muscleGroup: 'QUADS', mev: 12, mrv: 24 },
    });

    actAs(a.id);
    const res = await listTargets();
    const targets = await res.json();
    expect(targets).toEqual([{ muscleGroup: 'CHEST', mev: 8, mrv: 18 }]);
  });
});

describe('DELETE /api/volume-targets (reset to default)', () => {
  it('clears the owner target and is idempotent', async () => {
    const { a } = await seedUsers();
    await db.volumeTarget.create({
      data: { userId: a.id, muscleGroup: 'CHEST', mev: 8, mrv: 18 },
    });
    actAs(a.id);

    const res = await deleteTarget(jsonReq('DELETE', { muscleGroup: 'CHEST' }));
    expect(res.status).toBe(200);
    expect(await db.volumeTarget.count({ where: { userId: a.id } })).toBe(0);

    // Deleting again is a no-op success.
    const again = await deleteTarget(jsonReq('DELETE', { muscleGroup: 'CHEST' }));
    expect(again.status).toBe(200);
  });

  it("cannot clear another user's target", async () => {
    const { a, b } = await seedUsers();
    await db.volumeTarget.create({
      data: { userId: b.id, muscleGroup: 'QUADS', mev: 12, mrv: 24 },
    });

    actAs(a.id);
    const res = await deleteTarget(jsonReq('DELETE', { muscleGroup: 'QUADS' }));
    expect(res.status).toBe(200);
    // B's target is untouched: A only addressed its own (empty) rows.
    expect(await db.volumeTarget.count({ where: { userId: b.id } })).toBe(1);
  });
});
