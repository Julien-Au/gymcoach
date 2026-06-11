import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// First-class cardio sets (issue #133): logging duration/distance sets on a
// CARDIO exercise via the API, the cross-field validation, and the pinned
// unchanged strength path.

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as postSet } from '@/app/api/sessions/[id]/sets/route';

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
  const user = await db.user.create({
    data: { email: 'cardio@test.dev', passwordHash: 'x' },
  });
  const running = await db.exercise.create({
    data: { userId: user.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
  });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const session = await db.session.create({ data: { userId: user.id } });
  return { user, running, bench, session };
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/sessions/[id]/sets - cardio sets (issue #133)', () => {
  it('logs a cardio set with duration and distance, normalized to weight 0 / reps 1', async () => {
    const { user, running, session } = await seed();
    actAs(user.id);

    const res = await postSet(
      jsonReq('POST', {
        exerciseId: running.id,
        setNumber: 1,
        // Deliberately non-normalized weight/reps: the API must override them.
        weight: 50,
        reps: 8,
        rir: 2,
        durationSec: 750,
        distanceM: 2500,
      }),
      { params: { id: session.id } },
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.durationSec).toBe(750);
    expect(created.distanceM).toBe(2500);
    expect(created.weight).toBe(0);
    expect(created.reps).toBe(1);
    expect(created.rir).toBeNull();
  });

  it('logs a duration-only cardio set (distance optional)', async () => {
    const { user, running, session } = await seed();
    actAs(user.id);

    const res = await postSet(
      jsonReq('POST', {
        exerciseId: running.id,
        setNumber: 1,
        weight: 0,
        reps: 1,
        durationSec: 60,
      }),
      { params: { id: session.id } },
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.durationSec).toBe(60);
    expect(created.distanceM).toBeNull();
  });

  it('rejects a cardio set without a duration', async () => {
    const { user, running, session } = await seed();
    actAs(user.id);

    const res = await postSet(
      jsonReq('POST', {
        exerciseId: running.id,
        setNumber: 1,
        weight: 0,
        reps: 1,
        distanceM: 2500,
      }),
      { params: { id: session.id } },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/duration/i);
  });

  it('rejects duration/distance on a non-cardio exercise', async () => {
    const { user, bench, session } = await seed();
    actAs(user.id);

    const res = await postSet(
      jsonReq('POST', {
        exerciseId: bench.id,
        setNumber: 1,
        weight: 100,
        reps: 5,
        durationSec: 750,
      }),
      { params: { id: session.id } },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cardio/i);
  });

  it('rejects out-of-bounds duration and distance', async () => {
    const { user, running, session } = await seed();
    actAs(user.id);

    const tooLong = await postSet(
      jsonReq('POST', {
        exerciseId: running.id,
        setNumber: 1,
        weight: 0,
        reps: 1,
        durationSec: 86401,
      }),
      { params: { id: session.id } },
    );
    expect(tooLong.status).toBe(400);

    const tooFar = await postSet(
      jsonReq('POST', {
        exerciseId: running.id,
        setNumber: 1,
        weight: 0,
        reps: 1,
        durationSec: 600,
        distanceM: 1000001,
      }),
      { params: { id: session.id } },
    );
    expect(tooFar.status).toBe(400);
  });

  it('keeps the strength path unchanged: same payload, NULL cardio columns (pinned)', async () => {
    const { user, bench, session } = await seed();
    actAs(user.id);

    const res = await postSet(
      jsonReq('POST', {
        exerciseId: bench.id,
        setNumber: 1,
        weight: 102.5,
        reps: 5,
        rir: 2,
      }),
      { params: { id: session.id } },
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.weight).toBe(102.5);
    expect(created.reps).toBe(5);
    expect(created.rir).toBe(2);
    expect(created.durationSec).toBeNull();
    expect(created.distanceM).toBeNull();

    // The offline sync queue posts explicit nulls for strength sets; that
    // must also pass validation unchanged.
    const withNulls = await postSet(
      jsonReq('POST', {
        exerciseId: bench.id,
        setNumber: 2,
        weight: 102.5,
        reps: 5,
        rir: null,
        durationSec: null,
        distanceM: null,
      }),
      { params: { id: session.id } },
    );
    expect(withNulls.status).toBe(201);
  });

  it('refuses a cardio set on a session owned by someone else', async () => {
    const { running, session } = await seed();
    const stranger = await db.user.create({
      data: { email: 'stranger@test.dev', passwordHash: 'x' },
    });
    actAs(stranger.id);

    const res = await postSet(
      jsonReq('POST', {
        exerciseId: running.id,
        setNumber: 1,
        weight: 0,
        reps: 1,
        durationSec: 600,
      }),
      { params: { id: session.id } },
    );
    expect(res.status).toBe(404);
  });
});
