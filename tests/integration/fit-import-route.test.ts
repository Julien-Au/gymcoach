import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as postImport } from '@/app/api/import/fit/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function importReq(body: unknown): Request {
  return new Request('http://test.local/api/import/fit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// A real FIT file produced by the official Garmin SDK: running, 25 min, 5 km,
// HR 150/175, start 2026-03-15T09:00:00Z (same fixture as lib/import/fit.test.ts).
const RUN_FIT =
  'DgLYUlkAAAAuRklUmYtAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAAAQKRlE0gQAAEEAABIACP0EhgIEhgUBAgcEhggEhgkEhhABAhEBAgHsLhlEECkZRAFg4xYAYOMWACChBwCWr/Jq';
// Cycling, 60 min, 20 km, no HR, start 2025-12-01T07:30:00Z.
const BIKE_FIT =
  'DgLYUkoAAAAuRklU2JJAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAAD4949DCQAAAEEAABIABf0EhgIEhgUBAggEhgkEhgEIBpBD+PePQwKA7jYAgIQeAIKV';
const CORRUPT_FIT = (() => {
  const raw = Buffer.from(RUN_FIT, 'base64');
  raw[20] = (raw[20]! ^ 0xff) & 0xff; // breaks the CRC
  return raw.toString('base64');
})();

async function seedUser(email: string) {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/import/fit (preview)', () => {
  it('returns the parsed activity summary without writing anything', async () => {
    const user = await seedUser('fit-preview@test.dev');
    actAs(user.id);

    const res = await postImport(importReq({ fit: RUN_FIT, mode: 'preview' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      mode: 'preview',
      sport: 'Running',
      exerciseName: 'Running',
      startedAt: '2026-03-15T09:00:00.000Z',
      durationSec: 1500,
      distanceM: 5000,
      avgHr: 150,
      maxHr: 175,
      duplicateSessions: [],
    });

    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.exercise.count({ where: { userId: user.id } })).toBe(0);
  });

  it('warns about an existing session within 2 minutes of the activity start', async () => {
    const user = await seedUser('fit-duplicate@test.dev');
    actAs(user.id);
    await db.session.create({
      data: { userId: user.id, startedAt: new Date('2026-03-15T09:01:00.000Z') },
    });

    const res = await postImport(importReq({ fit: RUN_FIT, mode: 'preview' }));
    expect((await res.json()).duplicateSessions).toEqual(['2026-03-15T09:01:00.000Z']);
  });

  it("does not flag another user's session as a duplicate", async () => {
    const userA = await seedUser('fit-dup-a@test.dev');
    const userB = await seedUser('fit-dup-b@test.dev');
    await db.session.create({
      data: { userId: userB.id, startedAt: new Date('2026-03-15T09:00:00.000Z') },
    });

    actAs(userA.id);
    const res = await postImport(importReq({ fit: RUN_FIT, mode: 'preview' }));
    expect((await res.json()).duplicateSessions).toEqual([]);
  });

  it('rejects a corrupt FIT file with a 400 and writes nothing', async () => {
    const user = await seedUser('fit-corrupt@test.dev');
    actAs(user.id);
    // Flip a content byte so the CRC no longer matches.
    const raw = Buffer.from(RUN_FIT, 'base64');
    raw[20] = (raw[20]! ^ 0xff) & 0xff;
    const res = await postImport(
      importReq({ fit: raw.toString('base64'), mode: 'confirm' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/CRC|corrupt/i);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('requires auth', async () => {
    mockUserId.mockResolvedValue(null);
    const res = await postImport(importReq({ fit: RUN_FIT, mode: 'preview' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/import/fit (confirm)', () => {
  it('creates one session with one cardio set carrying avg+max HR on an auto-created CARDIO exercise', async () => {
    const user = await seedUser('fit-confirm@test.dev');
    actAs(user.id);

    const res = await postImport(importReq({ fit: RUN_FIT, mode: 'confirm' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: 'confirm',
      createdSessions: 1,
      createdSets: 1,
      createdExercises: 1,
      exerciseName: 'Running',
    });

    const session = await db.session.findFirst({
      where: { userId: user.id },
      include: { sets: { include: { exercise: true } } },
    });
    expect(session?.startedAt.toISOString()).toBe('2026-03-15T09:00:00.000Z');
    expect(session?.finishedAt?.toISOString()).toBe('2026-03-15T09:25:00.000Z');
    expect(session?.sets[0]).toMatchObject({
      setNumber: 1,
      weight: 0,
      reps: 1,
      durationSec: 1500,
      distanceM: 5000,
      avgHr: 150,
      maxHr: 175,
    });
    expect(session?.sets[0]?.exercise).toMatchObject({
      name: 'Running',
      category: 'CARDIO',
      muscleGroup: 'OTHER',
      userId: user.id,
    });
  });

  it('reuses the user-owned cardio exercise instead of creating a duplicate', async () => {
    const user = await seedUser('fit-reuse@test.dev');
    actAs(user.id);
    const existing = await db.exercise.create({
      data: { userId: user.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
    });

    const res = await postImport(importReq({ fit: RUN_FIT, mode: 'confirm' }));
    expect((await res.json()).createdExercises).toBe(0);
    const set = await db.set.findFirst({ where: { session: { userId: user.id } } });
    expect(set?.exerciseId).toBe(existing.id);
    expect(await db.exercise.count({ where: { userId: user.id, name: 'Running' } })).toBe(1);
  });

  it('refuses to write cardio onto a non-cardio exercise with the default name', async () => {
    const user = await seedUser('fit-conflict@test.dev');
    actAs(user.id);
    await db.exercise.create({
      data: { userId: user.id, name: 'Running', muscleGroup: 'QUADS', category: 'COMPOUND' },
    });

    const res = await postImport(importReq({ fit: RUN_FIT, mode: 'confirm' }));
    expect(res.status).toBe(409);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.set.count({ where: { session: { userId: user.id } } })).toBe(0);
  });
});

describe('POST /api/import/fit (batch, issue #253)', () => {
  it('previews every file in the batch, flagging the unparseable ones', async () => {
    const user = await seedUser('fit-batch-preview@test.dev');
    actAs(user.id);

    const res = await postImport(
      importReq({ fits: [RUN_FIT, CORRUPT_FIT, BIKE_FIT], mode: 'preview' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.importable).toBe(2);
    expect(body.skipped).toBe(1);
    expect(body.activities).toHaveLength(3);
    expect(body.activities[0]).toMatchObject({ index: 0, ok: true, sport: 'Running' });
    expect(body.activities[1]).toMatchObject({ index: 1, ok: false });
    expect(body.activities[2]).toMatchObject({ index: 2, ok: true, sport: 'Biking' });
    // Preview never writes.
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('confirms a batch as multiple sessions, skipping the bad file', async () => {
    const user = await seedUser('fit-batch-confirm@test.dev');
    actAs(user.id);

    const res = await postImport(
      importReq({ fits: [RUN_FIT, CORRUPT_FIT, BIKE_FIT], mode: 'confirm' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: 'confirm',
      createdSessions: 2,
      createdSets: 2,
      skipped: 1,
    });

    const sessions = await db.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(2);
    // Two distinct cardio exercises were created (Running + Cycling).
    const exercises = await db.exercise.findMany({
      where: { userId: user.id },
      select: { name: true },
    });
    expect(exercises.map((e) => e.name).sort()).toEqual(['Cycling', 'Running']);
  });

  it('requires auth for a batch too', async () => {
    mockUserId.mockResolvedValue(null);
    const res = await postImport(importReq({ fits: [RUN_FIT], mode: 'preview' }));
    expect(res.status).toBe(401);
  });
});
