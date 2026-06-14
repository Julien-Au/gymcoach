import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { parseTcx } from '@/lib/import/tcx';

// TCX export route (issue #175): ownership-scoped, cardio-only, and the emitted
// document round-trips through the existing parser to the same totals.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as getTcx } from '@/app/api/cardio/tcx/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

async function getFor(sessionId: string | null) {
  const url = sessionId
    ? `http://test.local/api/cardio/tcx?sessionId=${sessionId}`
    : 'http://test.local/api/cardio/tcx';
  return getTcx(new Request(url));
}

async function makeUser(email: string) {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('GET /api/cardio/tcx (issue #175)', () => {
  it('exports a cardio session that round-trips through the parser', async () => {
    const user = await makeUser('tcx-export@test.dev');
    const running = await db.exercise.create({
      data: { userId: user.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
    });
    const session = await db.session.create({
      data: {
        userId: user.id,
        startedAt: new Date('2026-06-01T10:00:00.000Z'),
        finishedAt: new Date('2026-06-01T10:30:00.000Z'),
      },
    });
    await db.set.create({
      data: {
        sessionId: session.id,
        exerciseId: running.id,
        setNumber: 1,
        weight: 0,
        reps: 1,
        durationSec: 1800,
        distanceM: 5000,
        avgHr: 152,
        maxHr: 181,
      },
    });

    actAs(user.id);
    const res = await getFor(session.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('gymcoach-2026-06-01.tcx');

    const parsed = parseTcx(await res.text());
    expect(parsed.ok).toBe(true);
    expect(parsed.activity!.durationSec).toBe(1800);
    expect(parsed.activity!.distanceM).toBe(5000);
    expect(parsed.activity!.avgHr).toBe(152);
    expect(parsed.activity!.maxHr).toBe(181);
    expect(parsed.activity!.sport).toBe('Running');
  });

  it("returns 404 for another user's session (ownership-scoped, no leak)", async () => {
    const owner = await makeUser('tcx-owner@test.dev');
    const running = await db.exercise.create({
      data: { userId: owner.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
    });
    const session = await db.session.create({
      data: { userId: owner.id, startedAt: new Date('2026-06-02T10:00:00.000Z') },
    });
    await db.set.create({
      data: {
        sessionId: session.id,
        exerciseId: running.id,
        setNumber: 1,
        weight: 0,
        reps: 1,
        durationSec: 1200,
        distanceM: 3000,
      },
    });

    const stranger = await makeUser('tcx-stranger@test.dev');
    actAs(stranger.id);
    const res = await getFor(session.id);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a session with no cardio sets', async () => {
    const user = await makeUser('tcx-strength@test.dev');
    const bench = await db.exercise.create({
      data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    const session = await db.session.create({
      data: { userId: user.id, startedAt: new Date('2026-06-03T10:00:00.000Z') },
    });
    await db.set.create({
      data: { sessionId: session.id, exerciseId: bench.id, setNumber: 1, weight: 100, reps: 5 },
    });

    actAs(user.id);
    const res = await getFor(session.id);
    expect(res.status).toBe(400);
  });

  it('returns 400 when sessionId is missing', async () => {
    const user = await makeUser('tcx-nosid@test.dev');
    actAs(user.id);
    const res = await getFor(null);
    expect(res.status).toBe(400);
  });
});
