import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as parseSet } from '@/app/api/sets/parse/route';

// Run the parse route against the deterministic demo provider so the test has
// no key dependency and exercises the real validation path.
const savedProvider = process.env.LLM_PROVIDER;
beforeAll(() => {
  process.env.LLM_PROVIDER = 'demo';
});
afterAll(() => {
  if (savedProvider === undefined) delete process.env.LLM_PROVIDER;
  else process.env.LLM_PROVIDER = savedProvider;
});

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function jsonReq(body: unknown): Request {
  return new Request('http://test.local/api/sets/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function seed() {
  const [a, b] = await Promise.all([
    db.user.create({ data: { email: 'parse-owner@test.dev', passwordHash: 'x' } }),
    db.user.create({ data: { email: 'parse-stranger@test.dev', passwordHash: 'x' } }),
  ]);
  const bench = await db.exercise.create({
    data: { userId: a.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const run = await db.exercise.create({
    data: { userId: a.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
  });
  const strangersBench = await db.exercise.create({
    data: { userId: b.id, name: 'B Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  return { a, b, bench, run, strangersBench };
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/sets/parse (issue #210)', () => {
  it('returns a validated strength parse for the owner exercise', async () => {
    const { a, bench } = await seed();
    actAs(a.id);
    const res = await parseSet(jsonReq({ exerciseId: bench.id, text: '100 for 8' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parsed).toEqual({ kind: 'strength', weight: 100, reps: 8, rir: 2 });
  });

  it('returns a cardio parse for a cardio exercise', async () => {
    const { a, run } = await seed();
    actAs(a.id);
    const res = await parseSet(
      jsonReq({ exerciseId: run.id, text: 'ran 5k in 25 minutes' }),
    );
    const body = await res.json();
    expect(body.parsed.kind).toBe('cardio');
    expect(body.parsed.durationSec).toBe(1500);
  });

  it('returns parsed: null (not an error) when the model cannot parse', async () => {
    const { a, bench } = await seed();
    actAs(a.id);
    // The demo provider returns the refusal sentinel for the UNPARSEABLE marker.
    const res = await parseSet(jsonReq({ exerciseId: bench.id, text: 'UNPARSEABLE junk' }));
    expect(res.status).toBe(200);
    expect((await res.json()).parsed).toBeNull();
  });

  it('does not log any set as a side effect of parsing', async () => {
    const { a, bench } = await seed();
    actAs(a.id);
    await parseSet(jsonReq({ exerciseId: bench.id, text: '100 for 8' }));
    expect(await db.set.count()).toBe(0);
    expect(await db.session.count()).toBe(0);
  });

  it("404s on another user's exercise (ownership)", async () => {
    const { a, strangersBench } = await seed();
    actAs(a.id);
    const res = await parseSet(
      jsonReq({ exerciseId: strangersBench.id, text: '100 for 8' }),
    );
    expect(res.status).toBe(404);
  });

  it('rejects an empty or missing text with 400', async () => {
    const { a, bench } = await seed();
    actAs(a.id);
    expect((await parseSet(jsonReq({ exerciseId: bench.id, text: '' }))).status).toBe(400);
    expect((await parseSet(jsonReq({ exerciseId: bench.id }))).status).toBe(400);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const { bench } = await seed();
    mockUserId.mockResolvedValue(null);
    const res = await parseSet(jsonReq({ exerciseId: bench.id, text: '100 for 8' }));
    expect(res.status).toBe(401);
  });
});
