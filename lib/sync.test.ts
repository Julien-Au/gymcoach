import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingSet } from '@/lib/indexeddb';

const { mockGetDB } = vi.hoisted(() => ({ mockGetDB: vi.fn() }));

vi.mock('@/lib/indexeddb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/indexeddb')>();
  return { ...actual, getDB: mockGetDB };
});

import { drainDroppedEquipment, flushPendingSets, onEquipmentDropped } from '@/lib/sync';

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

// A read that resolves in the same tick would hide every interleaving, so the
// stand-in below yields once before touching the item, as a real cursor does.
const io = () => new Promise((resolve) => setTimeout(resolve, 0));

// Minimal Dexie stand-in: one queued item, patched in place by update().
// `where(index)` answers for the two queries sync.ts makes, `status.anyOf` for
// the flush and `sessionId.equals` for the drain, and `modify` mutates the item
// through the query as a cursor does rather than handing back a copy.
//
// `transaction` serialises, because that is the guarantee the drain rests on:
// IndexedDB runs one `rw` transaction per store at a time, so a second drain
// cannot read the notice before the first has nulled it.
function fakeDB(item: PendingSet) {
  let queue: Promise<unknown> = Promise.resolve();
  const matching = (index: string, value: string) =>
    index === 'sessionId' && item.sessionId === value ? [item] : [];
  const table = {
    where: vi.fn((index: string) => ({
      anyOf: vi.fn(() => ({
        sortBy: vi.fn(async () => [item]),
        count: vi.fn(async () => (item.status === 'synced' ? 0 : 1)),
      })),
      equals: vi.fn((value: string) => ({
        toArray: vi.fn(async () => {
          await io();
          return matching(index, value);
        }),
        modify: vi.fn(async (change: (row: PendingSet) => void) => {
          await io();
          const rows = matching(index, value);
          for (const row of rows) change(row);
          return rows.length;
        }),
      })),
    })),
    update: vi.fn(async (_id: string, patch: Partial<PendingSet>) => {
      // A write that lands before the next reader's turn would close the very
      // window this fake exists to keep open, so it yields too.
      await io();
      Object.assign(item, patch);
      return 1;
    }),
  };
  return {
    pendingSets: table,
    transaction: vi.fn(<T>(_mode: string, _scope: unknown, body: () => Promise<T>) => {
      const run = queue.then(body);
      queue = run.catch(() => undefined);
      return run;
    }),
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
    // The retry recorded the set without its equipment: that is a dropped
    // reference like any other, so it is cleared locally and reported.
    expect(item.gymEquipmentId).toBeNull();
    expect(result).toEqual({
      flushed: 1,
      failed: 0,
      pending: 0,
      droppedEquipment: [
        { localId: 'local-1', sessionId: 'session-1', gymEquipmentId: 'stale-equipment' },
      ],
    });
  });

  it('clears and reports an equipment reference the server recorded as null (issue #326)', async () => {
    const item = pendingSet();
    mockGetDB.mockReturnValue(fakeDB(item));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'server-set-2', gymEquipmentId: null }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const listener = vi.fn();
    const unsubscribe = onEquipmentDropped(listener);

    const result = await flushPendingSets();
    unsubscribe();

    expect(item.status).toBe('synced');
    expect(item.gymEquipmentId).toBeNull();
    expect(result.droppedEquipment).toEqual([
      { localId: 'local-1', sessionId: 'session-1', gymEquipmentId: 'stale-equipment' },
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(result.droppedEquipment);
  });

  it('keeps an equipment reference the server attached and stays silent', async () => {
    const item = pendingSet();
    mockGetDB.mockReturnValue(fakeDB(item));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'server-set-3', gymEquipmentId: 'stale-equipment' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const listener = vi.fn();
    const unsubscribe = onEquipmentDropped(listener);

    const result = await flushPendingSets();
    unsubscribe();

    expect(item.gymEquipmentId).toBe('stale-equipment');
    expect(result.droppedEquipment).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not report a set that never carried an equipment reference', async () => {
    const item = { ...pendingSet(), gymEquipmentId: null };
    mockGetDB.mockReturnValue(fakeDB(item));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'server-set-4', gymEquipmentId: null }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const listener = vi.fn();
    const unsubscribe = onEquipmentDropped(listener);

    const result = await flushPendingSets();
    unsubscribe();

    expect(result.droppedEquipment).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });
});

// Issue #337: the notice was broadcast to live subscribers only, so a flush
// that completed with no SessionRunner mounted told nobody and was gone.
describe('dropped equipment survives a flush nobody was listening to', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  async function flushWithDropAndNoListener(item: PendingSet) {
    mockGetDB.mockReturnValue(fakeDB(item));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'server-set-5', gymEquipmentId: null }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    // Deliberately no `onEquipmentDropped` subscriber: this is the reported
    // path. Log a set offline, close the app, reopen on the dashboard, where
    // `sync-bootstrap` flushes with no SessionRunner mounted.
    return flushPendingSets();
  }

  it('records the drop on the set rather than only announcing it', async () => {
    const item = pendingSet();
    await flushWithDropAndNoListener(item);

    expect(item.gymEquipmentId).toBeNull();
    expect(item.equipmentDroppedNotice).toBe('stale-equipment');
  });

  it('hands the drop to a runner that mounts afterwards', async () => {
    const item = pendingSet();
    await flushWithDropAndNoListener(item);

    // What SessionRunner does on mount.
    expect(await drainDroppedEquipment('session-1')).toEqual([
      { localId: 'local-1', sessionId: 'session-1', gymEquipmentId: 'stale-equipment' },
    ]);
  });

  it('shows it exactly once: a second drain is empty', async () => {
    const item = pendingSet();
    await flushWithDropAndNoListener(item);

    await drainDroppedEquipment('session-1');

    // The mount drain and the broadcast-triggered drain both run in
    // SessionRunner; clearing is what stops them reporting the same set twice.
    expect(await drainDroppedEquipment('session-1')).toEqual([]);
    expect(item.equipmentDroppedNotice).toBeNull();
  });

  it('two drains at once still report it once', async () => {
    const item = pendingSet();
    await flushWithDropAndNoListener(item);

    // Both callers are in SessionRunner and do overlap: `reactStrictMode` fires
    // the mount effect twice in development, and in production a broadcast can
    // land while the mount drain is still awaiting its read. Clearing after a
    // read that both have already made would show the toast twice.
    const [mount, broadcast] = await Promise.all([
      drainDroppedEquipment('session-1'),
      drainDroppedEquipment('session-1'),
    ]);

    expect([...mount, ...broadcast]).toEqual([
      { localId: 'local-1', sessionId: 'session-1', gymEquipmentId: 'stale-equipment' },
    ]);
    expect(item.equipmentDroppedNotice).toBeNull();
  });

  it('does not hand one session the drops of another', async () => {
    const item = pendingSet();
    await flushWithDropAndNoListener(item);

    expect(await drainDroppedEquipment('another-session')).toEqual([]);
    // And the notice is still there for the session it belongs to.
    expect(item.equipmentDroppedNotice).toBe('stale-equipment');
  });

  it('returns nothing when a set synced with its equipment intact', async () => {
    const item = pendingSet();
    mockGetDB.mockReturnValue(fakeDB(item));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'server-set-6', gymEquipmentId: 'stale-equipment' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await flushPendingSets();

    expect(item.equipmentDroppedNotice).toBeUndefined();
    expect(await drainDroppedEquipment('session-1')).toEqual([]);
  });
});
