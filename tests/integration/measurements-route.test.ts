import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as listEntries, POST as postEntry } from '@/app/api/measurements/route';
import { DELETE as deleteEntry } from '@/app/api/measurements/[id]/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function jsonReq(method: string, body: unknown): Request {
  return new Request('http://test.local/api/measurements', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function listReq(query = ''): Request {
  return new Request(`http://test.local/api/measurements${query}`, { method: 'GET' });
}

async function seed() {
  const [a, b] = await Promise.all([
    db.user.create({ data: { email: 'owner@test.dev', passwordHash: 'x' } }),
    db.user.create({ data: { email: 'stranger@test.dev', passwordHash: 'x' } }),
  ]);
  return { a, b };
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/measurements', () => {
  it('creates a measurement scoped to the authenticated user', async () => {
    const { a } = await seed();
    actAs(a.id);
    const res = await postEntry(jsonReq('POST', { site: 'WAIST', valueCm: 82.5 }));
    expect(res.status).toBe(201);
    const entry = await res.json();
    expect(entry.site).toBe('WAIST');
    expect(entry.valueCm).toBe(82.5);
    expect(entry.userId).toBe(a.id);
    expect(await db.bodyMeasurement.count({ where: { userId: a.id } })).toBe(1);
  });

  it('stores the optional note', async () => {
    const { a } = await seed();
    actAs(a.id);
    const res = await postEntry(
      jsonReq('POST', { site: 'ARM_LEFT', valueCm: 36, note: 'flexed' }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).note).toBe('flexed');
  });

  it('rejects an out-of-bounds value (Zod) and writes nothing', async () => {
    const { a } = await seed();
    actAs(a.id);
    const res = await postEntry(jsonReq('POST', { site: 'WAIST', valueCm: 500 }));
    expect(res.status).toBe(400);
    expect(await db.bodyMeasurement.count()).toBe(0);
  });

  it('rejects an unknown site (Zod) and writes nothing', async () => {
    const { a } = await seed();
    actAs(a.id);
    const res = await postEntry(jsonReq('POST', { site: 'EARLOBE', valueCm: 10 }));
    expect(res.status).toBe(400);
    expect(await db.bodyMeasurement.count()).toBe(0);
  });

  it('requires auth', async () => {
    await seed();
    mockUserId.mockResolvedValue(null);
    const res = await postEntry(jsonReq('POST', { site: 'WAIST', valueCm: 80 }));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/measurements', () => {
  it("lists only the user's own entries, newest first", async () => {
    const { a, b } = await seed();
    actAs(a.id);
    await postEntry(jsonReq('POST', { site: 'WAIST', valueCm: 84 }));
    await postEntry(jsonReq('POST', { site: 'WAIST', valueCm: 82 }));

    actAs(b.id);
    expect(await (await listEntries(listReq())).json()).toEqual([]);

    actAs(a.id);
    const own = await (await listEntries(listReq())).json();
    expect(own).toHaveLength(2);
    // Newest first (the second POST is newer).
    expect(own[0].valueCm).toBe(82);
    expect(own[1].valueCm).toBe(84);
  });

  it('filters by site when a valid site is given', async () => {
    const { a } = await seed();
    actAs(a.id);
    await postEntry(jsonReq('POST', { site: 'WAIST', valueCm: 82 }));
    await postEntry(jsonReq('POST', { site: 'HIPS', valueCm: 95 }));

    const waist = await (await listEntries(listReq('?site=WAIST'))).json();
    expect(waist).toHaveLength(1);
    expect(waist[0].site).toBe('WAIST');
  });

  it('falls back to all sites for an invalid site filter', async () => {
    const { a } = await seed();
    actAs(a.id);
    await postEntry(jsonReq('POST', { site: 'WAIST', valueCm: 82 }));
    await postEntry(jsonReq('POST', { site: 'HIPS', valueCm: 95 }));

    const all = await (await listEntries(listReq('?site=NOPE'))).json();
    expect(all).toHaveLength(2);
  });
});

describe('DELETE /api/measurements/[id]', () => {
  it('deletes the user\'s own measurement', async () => {
    const { a } = await seed();
    actAs(a.id);
    const created = await (
      await postEntry(jsonReq('POST', { site: 'CHEST', valueCm: 102 }))
    ).json();

    const res = await deleteEntry(new Request('http://t/api', { method: 'DELETE' }), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(res.status).toBe(200);
    expect(await db.bodyMeasurement.count({ where: { userId: a.id } })).toBe(0);
  });

  it("returns 404 and keeps the entry when a stranger tries to delete it", async () => {
    const { a, b } = await seed();
    actAs(a.id);
    const created = await (
      await postEntry(jsonReq('POST', { site: 'CHEST', valueCm: 102 }))
    ).json();

    actAs(b.id);
    const res = await deleteEntry(new Request('http://t/api', { method: 'DELETE' }), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(res.status).toBe(404);
    expect(await db.bodyMeasurement.count()).toBe(1);
  });

  it('returns 404 for a missing id', async () => {
    const { a } = await seed();
    actAs(a.id);
    const res = await deleteEntry(new Request('http://t/api', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'does-not-exist' }),
    });
    expect(res.status).toBe(404);
  });
});
