import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { HISTORY_CSV_HEADERS } from '@/lib/csv';

// CSV history export with cardio columns (issue #144): the export must
// round-trip duration/distance, with the pre-existing column order untouched.

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as getCsv } from '@/app/api/history/csv/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

async function seedMixedSession() {
  const user = await db.user.create({
    data: { email: 'csv-export@test.dev', passwordHash: 'x' },
  });
  const running = await db.exercise.create({
    data: { userId: user.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
  });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const session = await db.session.create({
    data: {
      userId: user.id,
      startedAt: new Date('2026-06-01T10:00:00Z'),
      finishedAt: new Date('2026-06-01T11:00:00Z'),
    },
  });
  await db.set.create({
    data: {
      sessionId: session.id,
      exerciseId: bench.id,
      setNumber: 1,
      weight: 100,
      reps: 5,
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
    },
  });
  return { user, session };
}

async function exportRows(): Promise<{ header: string[]; rows: string[][] }> {
  const res = await getCsv(new Request('http://test.local/api/history/csv'));
  expect(res.status).toBe(200);
  const body = (await res.text()).replace(/^﻿/, '');
  // Numeric-only cells in these fixtures: a plain split is safe.
  const [header, ...rows] = body.split('\n').map((line) => line.split(','));
  if (!header) throw new Error('empty CSV export');
  return { header, rows };
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('GET /api/history/csv - cardio columns (issue #144)', () => {
  it('appends duration_sec and distance_m, populated only on cardio rows', async () => {
    const { user } = await seedMixedSession();
    actAs(user.id);

    const { header, rows } = await exportRows();
    expect(header).toEqual([...HISTORY_CSV_HEADERS]);

    const durationIdx = header.indexOf('duration_sec');
    const distanceIdx = header.indexOf('distance_m');
    expect(durationIdx).toBe(header.length - 2);
    expect(distanceIdx).toBe(header.length - 1);

    const exerciseIdx = header.indexOf('exercise');
    const strengthRow = rows.find((r) => r[exerciseIdx] === 'Bench');
    const cardioRow = rows.find((r) => r[exerciseIdx] === 'Running');
    expect(strengthRow).toBeDefined();
    expect(cardioRow).toBeDefined();

    // Cardio row: raw storage units, stored row shape (weight 0 / reps 1).
    expect(cardioRow![durationIdx]).toBe('1800');
    expect(cardioRow![distanceIdx]).toBe('5000');
    expect(cardioRow![header.indexOf('external_load_kg')]).toBe('0');
    expect(cardioRow![header.indexOf('reps')]).toBe('1');

    // Strength row: cardio columns empty, lifting cells unchanged.
    expect(strengthRow![durationIdx]).toBe('');
    expect(strengthRow![distanceIdx]).toBe('');
    expect(strengthRow![header.indexOf('external_load_kg')]).toBe('100');
    expect(strengthRow![header.indexOf('reps')]).toBe('5');
    expect(strengthRow![header.indexOf('volume_kg')]).toBe('500');
  });
});
