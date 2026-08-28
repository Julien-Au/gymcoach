import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingSet } from '@/lib/indexeddb';

const { mockGetDB } = vi.hoisted(() => ({ mockGetDB: vi.fn() }));

vi.mock('@/lib/indexeddb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/indexeddb')>();
  return { ...actual, getDB: mockGetDB };
});

import { flushPendingSets } from '@/lib/sync';

function pendingSet(): PendingSet {
  return {
    localId: 'local-1',
    sessionId: 'session-1',
    exerciseId: 'exercise-1',
    gymEquipmentId: 'stale-equipment',
    setNumber: 1,
    weight: 82.5,
    reps: 7,
    rir: 2,
    notes: 'offline set',
    isWarmup: false,
    isDropSet: false,
    createdAt: 1,
    status: 'pending',
    serverId: null,
    syncedAt: null,
    attempts: 0,
    lastError: null,
  };
}

describe('offline set sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('retries a 400 once without stale optional equipment and preserves the training set', async () => {
    const item = pendingSet();
    const updates: Array<Partial<PendingSet>> = [];
    const table = {
      where: vi.fn(() => ({
        anyOf: vi.fn(() => ({
          sortBy: vi.fn(async () => [item]),
          count: vi.fn(async () => (item.status === 'synced' ? 0 : 1)),
        })),
      })),
      update: vi.fn(async (_id: string, patch: Partial<PendingSet>) => {
        Object.assign(item, patch);
        updates.push(patch);
        return 1;
      }),
    };
    mockGetDB.mockReturnValue({ pendingSets: table });

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Equipment is not available for this exercise.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'server-set-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const result = await flushPendingSets();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const retryBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(firstBody).toMatchObject({
      gymEquipmentId: 'stale-equipment',
      weight: 82.5,
      reps: 7,
      rir: 2,
    });
    expect(retryBody).toMatchObject({
      gymEquipmentId: null,
      weight: 82.5,
      reps: 7,
      rir: 2,
    });
    expect(item.status).toBe('synced');
    expect(item.serverId).toBe('server-set-1');
    expect(updates.at(-1)).toMatchObject({ status: 'synced', serverId: 'server-set-1' });
    expect(result).toEqual({ flushed: 1, failed: 0, pending: 0 });
  });
});
