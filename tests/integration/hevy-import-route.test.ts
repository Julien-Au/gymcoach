import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as postImport } from '@/app/api/import/hevy/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function importReq(body: unknown): Request {
  return new Request('http://test.local/api/import/hevy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const HEADER =
  'title,start_time,end_time,exercise_title,set_index,set_type,weight_kg,reps,distance_km,duration_seconds';

const CSV = [
  HEADER,
  'Push Day,2026-05-02 09:13:00,2026-05-02 10:05:00,Bench Press,0,warmup,40,8,,',
  'Push Day,2026-05-02 09:13:00,2026-05-02 10:05:00,Bench Press,1,normal,80,8,,',
  'Push Day,2026-05-02 09:13:00,2026-05-02 10:05:00,Bench Press,2,dropset,60,10,,',
  'Pull Day,2026-05-03 18:00:00,2026-05-03 18:45:00,Imported Row,0,normal,70,10,,',
  'Pull Day,2026-05-03 18:00:00,2026-05-03 18:45:00,Running,0,normal,,,5,1800',
].join('\n');

async function seedUser(email = 'hevy-importer@test.dev') {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/import/hevy (preview)', () => {
  it('returns counts and per-line info without writing anything', async () => {
    const user = await seedUser();
    actAs(user.id);

    const res = await postImport(importReq({ csv: CSV, mode: 'preview' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      mode: 'preview',
      sessions: 2,
      sets: 4,
      newExercises: ['Bench Press', 'Imported Row'],
      duplicatesSkipped: 0,
      cardioSkipped: 1,
      errorCount: 0,
    });

    expect(await db.session.count()).toBe(0);
    expect(await db.set.count()).toBe(0);
    expect(await db.exercise.count()).toBe(0);
  });

  it('rejects an unrecognized header with a clear message', async () => {
    const user = await seedUser();
    actAs(user.id);
    const res = await postImport(importReq({ csv: 'foo,bar\n1,2', mode: 'preview' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/unrecognized format/i);
  });

  it('rejects a Strong-format file with the Hevy message (formats are not interchangeable)', async () => {
    const user = await seedUser();
    actAs(user.id);
    const res = await postImport(
      importReq({
        csv: 'Date,Workout Name,Exercise Name,Set Order,Weight,Reps\n2026-05-02,Push,Bench,1,80,8',
        mode: 'preview',
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/hevy csv export/i);
  });

  it('requires auth', async () => {
    mockUserId.mockResolvedValue(null);
    const res = await postImport(importReq({ csv: CSV, mode: 'preview' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/import/hevy (confirm)', () => {
  it('creates sessions with real start/end times and mapped set flags, transactionally', async () => {
    const user = await seedUser();
    actAs(user.id);

    const res = await postImport(importReq({ csv: CSV, mode: 'confirm' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      mode: 'confirm',
      createdSessions: 2,
      createdSets: 4,
      createdExercises: 2,
      cardioSkipped: 1,
    });

    const sessions = await db.session.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'asc' },
      include: { sets: { orderBy: { setNumber: 'asc' } } },
    });
    expect(sessions).toHaveLength(2);
    // Real export times, not the noon-UTC fallback.
    expect(sessions[0]?.startedAt.toISOString()).toBe('2026-05-02T09:13:00.000Z');
    expect(sessions[0]?.finishedAt?.toISOString()).toBe('2026-05-02T10:05:00.000Z');
    expect(sessions[0]?.notes).toBe('Imported from Hevy - Push Day');

    // set_type mapping persisted: warmup, normal, dropset.
    expect(sessions[0]?.sets.map((s) => [s.isWarmup, s.isDropSet])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);

    const created = await db.exercise.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    });
    expect(created.map((e) => e.notes)).toEqual([
      'Imported from Hevy. Adjust the muscle group and category.',
      'Imported from Hevy. Adjust the muscle group and category.',
    ]);
  });

  it("never matches or touches another user's exercises", async () => {
    const user = await seedUser();
    const other = await seedUser('hevy-other@test.dev');
    await db.exercise.create({
      data: { userId: other.id, name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    actAs(user.id);

    await postImport(importReq({ csv: CSV, mode: 'confirm' }));
    expect(
      await db.exercise.count({ where: { userId: user.id, name: 'Bench Press' } }),
    ).toBe(1);
    expect(await db.set.count({ where: { session: { userId: other.id } } })).toBe(0);
  });

  it('skips exact duplicates on re-import (idempotence)', async () => {
    const user = await seedUser();
    actAs(user.id);

    await postImport(importReq({ csv: CSV, mode: 'confirm' }));
    const res = await postImport(importReq({ csv: CSV, mode: 'confirm' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nothing to import/i);

    expect(await db.session.count({ where: { userId: user.id } })).toBe(2);
    expect(await db.set.count({ where: { session: { userId: user.id } } })).toBe(4);
  });

  it('rejects invalid input (Zod) and writes nothing', async () => {
    const user = await seedUser();
    actAs(user.id);
    // 'unit' is a Strong-only field; mode must be preview|confirm.
    const res = await postImport(importReq({ csv: CSV, mode: 'apply' }));
    expect(res.status).toBe(400);
    expect(await db.session.count()).toBe(0);
  });

  it('leaves the Strong import route behavior intact (shared executor, distinct labels)', async () => {
    // Guards the refactor: the Strong route still writes its own notes.
    const user = await seedUser();
    actAs(user.id);
    const { POST: postStrong } = await import('@/app/api/import/strong/route');
    const strongCsv = [
      'Date,Workout Name,Exercise Name,Set Order,Weight,Reps',
      '2026-06-01 09:00:00,Push,Bench,1,80,8',
    ].join('\n');
    const res = await postStrong(
      new Request('http://test.local/api/import/strong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: strongCsv, mode: 'confirm' }),
      }),
    );
    expect(res.status).toBe(200);
    const session = await db.session.findFirstOrThrow({ where: { userId: user.id } });
    // Unchanged Strong behavior: noon-UTC fallback and Strong-labelled notes.
    expect(session.startedAt.toISOString()).toBe('2026-06-01T12:00:00.000Z');
    expect(session.notes).toBe('Imported from Strong - Push');
  });
});
