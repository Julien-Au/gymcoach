import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as postImport } from '@/app/api/import/tcx/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function importReq(body: unknown): Request {
  return new Request('http://test.local/api/import/tcx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const RUN_TCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-05-20T07:30:00.000Z</Id>
      <Lap StartTime="2026-05-20T07:30:00.000Z">
        <TotalTimeSeconds>1800</TotalTimeSeconds>
        <DistanceMeters>5000</DistanceMeters>
        <AverageHeartRateBpm><Value>152</Value></AverageHeartRateBpm>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

async function seedUser(email: string) {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/import/tcx (preview)', () => {
  it('returns the parsed activity summary without writing anything', async () => {
    const user = await seedUser('tcx-preview@test.dev');
    actAs(user.id);

    const res = await postImport(importReq({ xml: RUN_TCX, mode: 'preview' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      mode: 'preview',
      sport: 'Running',
      exerciseName: 'Running',
      startedAt: '2026-05-20T07:30:00.000Z',
      durationSec: 1800,
      distanceM: 5000,
      avgHr: 152,
      duplicateSessions: [],
    });

    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.exercise.count({ where: { userId: user.id } })).toBe(0);
  });

  it('warns about an existing session within 2 minutes of the activity start', async () => {
    const user = await seedUser('tcx-duplicate@test.dev');
    actAs(user.id);
    await db.session.create({
      data: { userId: user.id, startedAt: new Date('2026-05-20T07:31:00.000Z') },
    });

    const res = await postImport(importReq({ xml: RUN_TCX, mode: 'preview' }));
    const body = await res.json();
    expect(body.duplicateSessions).toEqual(['2026-05-20T07:31:00.000Z']);
  });

  it("does not flag another user's session as a duplicate", async () => {
    const userA = await seedUser('tcx-dup-a@test.dev');
    const userB = await seedUser('tcx-dup-b@test.dev');
    await db.session.create({
      data: { userId: userB.id, startedAt: new Date('2026-05-20T07:30:00.000Z') },
    });

    actAs(userA.id);
    const res = await postImport(importReq({ xml: RUN_TCX, mode: 'preview' }));
    expect((await res.json()).duplicateSessions).toEqual([]);
  });

  it('rejects a file with a DTD with a 400 and writes nothing', async () => {
    const user = await seedUser('tcx-dtd@test.dev');
    actAs(user.id);
    const res = await postImport(
      importReq({
        xml: `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>${RUN_TCX}`,
        mode: 'confirm',
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not allowed/);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('requires auth', async () => {
    mockUserId.mockResolvedValue(null);
    const res = await postImport(importReq({ xml: RUN_TCX, mode: 'preview' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/import/tcx (confirm)', () => {
  it('creates one session with one cardio set carrying avgHr, on an auto-created CARDIO exercise', async () => {
    const user = await seedUser('tcx-confirm@test.dev');
    actAs(user.id);

    const res = await postImport(importReq({ xml: RUN_TCX, mode: 'confirm' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
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
    expect(session?.startedAt.toISOString()).toBe('2026-05-20T07:30:00.000Z');
    expect(session?.finishedAt?.toISOString()).toBe('2026-05-20T08:00:00.000Z');
    const set = session?.sets[0];
    expect(set).toMatchObject({
      setNumber: 1,
      weight: 0,
      reps: 1,
      durationSec: 1800,
      distanceM: 5000,
      avgHr: 152,
    });
    expect(set?.exercise).toMatchObject({
      name: 'Running',
      category: 'CARDIO',
      muscleGroup: 'OTHER',
      userId: user.id,
    });
  });

  it('reuses the user-owned cardio exercise instead of creating a duplicate', async () => {
    const user = await seedUser('tcx-reuse@test.dev');
    actAs(user.id);
    const existing = await db.exercise.create({
      data: { userId: user.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
    });

    const res = await postImport(importReq({ xml: RUN_TCX, mode: 'confirm' }));
    const body = await res.json();
    expect(body.createdExercises).toBe(0);

    const set = await db.set.findFirst({ where: { session: { userId: user.id } } });
    expect(set?.exerciseId).toBe(existing.id);
    // Still exactly one "Running" exercise for this user.
    expect(await db.exercise.count({ where: { userId: user.id, name: 'Running' } })).toBe(1);
  });

  it("never reuses another user's exercise (ownership-scoped)", async () => {
    const userA = await seedUser('tcx-own-a@test.dev');
    const userB = await seedUser('tcx-own-b@test.dev');
    const foreign = await db.exercise.create({
      data: { userId: userB.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
    });

    actAs(userA.id);
    await postImport(importReq({ xml: RUN_TCX, mode: 'confirm' }));

    const set = await db.set.findFirst({ where: { session: { userId: userA.id } } });
    expect(set?.exerciseId).not.toBe(foreign.id);
    const own = await db.exercise.findFirst({ where: { userId: userA.id, name: 'Running' } });
    expect(set?.exerciseId).toBe(own?.id);
  });

  it('refuses to write cardio onto a non-cardio exercise with the default name', async () => {
    const user = await seedUser('tcx-conflict@test.dev');
    actAs(user.id);
    await db.exercise.create({
      data: { userId: user.id, name: 'Running', muscleGroup: 'QUADS', category: 'COMPOUND' },
    });

    const res = await postImport(importReq({ xml: RUN_TCX, mode: 'confirm' }));
    expect(res.status).toBe(409);
    // Transactional: nothing was written.
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.set.count({ where: { session: { userId: user.id } } })).toBe(0);
  });
});
