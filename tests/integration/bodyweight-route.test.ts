import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
// Mock it so we can act as either user without real cookies/JWTs.
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as listEntries, POST as postEntry } from '@/app/api/bodyweight/route';
import { DELETE as deleteEntry } from '@/app/api/bodyweight/[id]/route';

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

async function seed() {
  const [a, b] = await Promise.all([
    db.user.create({
      data: { email: 'owner@test.dev', passwordHash: 'x', bodyweight: 75 },
    }),
    db.user.create({ data: { email: 'stranger@test.dev', passwordHash: 'x' } }),
  ]);
  return { a, b };
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/bodyweight', () => {
  it('creates an entry and syncs User.bodyweight to it', async () => {
    const { a } = await seed();
    actAs(a.id);
    const res = await postEntry(jsonReq('POST', { weightKg: 81.4 }));
    expect(res.status).toBe(201);
    const entry = await res.json();
    expect(entry.weightKg).toBe(81.4);

    const user = await db.user.findUnique({ where: { id: a.id } });
    expect(user?.bodyweight).toBe(81.4);
    expect(await db.bodyweightEntry.count({ where: { userId: a.id } })).toBe(1);
  });

  it('stores the optional note', async () => {
    const { a } = await seed();
    actAs(a.id);
    const res = await postEntry(
      jsonReq('POST', { weightKg: 80, note: 'morning, fasted' }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).note).toBe('morning, fasted');
  });

  it('rejects invalid input (Zod) and writes nothing', async () => {
    const { a } = await seed();
    actAs(a.id);
    const res = await postEntry(jsonReq('POST', { weightKg: -5 }));
    expect(res.status).toBe(400);
    expect(await db.bodyweightEntry.count()).toBe(0);
    const user = await db.user.findUnique({ where: { id: a.id } });
    expect(user?.bodyweight).toBe(75);
  });

  it('requires auth', async () => {
    await seed();
    mockUserId.mockResolvedValue(null);
    const res = await postEntry(jsonReq('POST', { weightKg: 80 }));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/bodyweight', () => {
  it("lists only the user's own entries, newest first", async () => {
    const { a, b } = await seed();
    actAs(a.id);
    await postEntry(jsonReq('POST', { weightKg: 80 }));
    await postEntry(jsonReq('POST', { weightKg: 81 }));

    actAs(b.id);
    expect(await (await listEntries()).json()).toEqual([]);

    actAs(a.id);
    const own = await (await listEntries()).json();
    expect(own).toHaveLength(2);
    expect(own[0].weightKg).toBe(81);
    expect(own[1].weightKg).toBe(80);
  });
});

describe('DELETE /api/bodyweight/[id]', () => {
  it('re-syncs User.bodyweight to the newest remaining entry when the newest is deleted', async () => {
    const { a } = await seed();
    actAs(a.id);
    // Two entries with distinct measuredAt timestamps.
    const older = await db.bodyweightEntry.create({
      data: { userId: a.id, weightKg: 79, measuredAt: new Date('2026-06-01T08:00:00Z') },
    });
    const newer = await db.bodyweightEntry.create({
      data: { userId: a.id, weightKg: 82, measuredAt: new Date('2026-06-08T08:00:00Z') },
    });
    await db.user.update({ where: { id: a.id }, data: { bodyweight: 82 } });

    const res = await deleteEntry(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: newer.id },
    });
    expect(res.status).toBe(200);
    const user = await db.user.findUnique({ where: { id: a.id } });
    expect(user?.bodyweight).toBe(79);
    expect(await db.bodyweightEntry.count({ where: { userId: a.id } })).toBe(1);

    // Cleanup reference so lint does not flag the unused variable.
    expect(older.weightKg).toBe(79);
  });

  it('keeps User.bodyweight when a non-newest entry is deleted', async () => {
    const { a } = await seed();
    actAs(a.id);
    const older = await db.bodyweightEntry.create({
      data: { userId: a.id, weightKg: 79, measuredAt: new Date('2026-06-01T08:00:00Z') },
    });
    await db.bodyweightEntry.create({
      data: { userId: a.id, weightKg: 82, measuredAt: new Date('2026-06-08T08:00:00Z') },
    });
    await db.user.update({ where: { id: a.id }, data: { bodyweight: 82 } });

    await deleteEntry(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: older.id },
    });
    const user = await db.user.findUnique({ where: { id: a.id } });
    expect(user?.bodyweight).toBe(82);
  });

  it('leaves the profile value as is when the last entry is deleted', async () => {
    const { a } = await seed();
    actAs(a.id);
    const only = await (await postEntry(jsonReq('POST', { weightKg: 81 }))).json();

    await deleteEntry(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: only.id },
    });
    expect(await db.bodyweightEntry.count()).toBe(0);
    const user = await db.user.findUnique({ where: { id: a.id } });
    // The 81 written by the POST sync stays; no entry remains to re-derive from.
    expect(user?.bodyweight).toBe(81);
  });

  it("returns 404 and keeps the entry when a stranger tries to delete it", async () => {
    const { a, b } = await seed();
    actAs(a.id);
    const entry = await (await postEntry(jsonReq('POST', { weightKg: 81 }))).json();

    actAs(b.id);
    const res = await deleteEntry(new Request('http://t/api', { method: 'DELETE' }), {
      params: { id: entry.id },
    });
    expect(res.status).toBe(404);
    expect(await db.bodyweightEntry.count()).toBe(1);
  });
});
