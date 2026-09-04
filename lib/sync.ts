// ============================================================
// Sync queue: flush the pending sets to the API
// ============================================================
// Strategy:
// 1. When a set is validated locally, we write it to IndexedDB
//    (status='pending') and trigger a flush.
// 2. flushPendingSets() takes each pending one in order, attempts the POST
//    and marks it according to the result.
// 3. On app startup + on the 'online' event, we call flushPendingSets().
// 4. No aggressive retry: we wait for the next trigger (online, validation,
//    startup). If you cut the wifi in the middle, the app will retry when
//    the network comes back. No background timer, to save battery.

import { getDB, type PendingSet } from '@/lib/indexeddb';

export interface FlushResult {
  flushed: number;
  failed: number;
  pending: number;
  // Sets the server recorded WITHOUT the equipment reference that was sent
  // (issue #326): the item was deleted, unlinked, belongs to another gym or
  // another user. The set itself is saved; only the decoration was dropped.
  droppedEquipment: DroppedEquipment[];
}

export interface DroppedEquipment {
  localId: string;
  sessionId: string;
  gymEquipmentId: string;
}

type DroppedEquipmentListener = (dropped: DroppedEquipment[]) => void;

const droppedEquipmentListeners = new Set<DroppedEquipmentListener>();

// Subscribe to equipment references the server dropped while flushing. The
// flush runs in the background (queueSet does not await it), so the session
// UI cannot read the result directly; it listens here instead. Returns the
// unsubscribe function.
export function onEquipmentDropped(listener: DroppedEquipmentListener): () => void {
  droppedEquipmentListeners.add(listener);
  return () => {
    droppedEquipmentListeners.delete(listener);
  };
}

let inFlight: Promise<FlushResult> | null = null;

export async function flushPendingSets(): Promise<FlushResult> {
  // Re-entrancy: if a flush is already running, we return its promise.
  if (inFlight) return inFlight;
  inFlight = doFlush();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

async function doFlush(): Promise<FlushResult> {
  const db = getDB();
  const pending = await db.pendingSets
    .where('status')
    .anyOf(['pending', 'failed'])
    .sortBy('createdAt');

  let flushed = 0;
  let failed = 0;
  const droppedEquipment: DroppedEquipment[] = [];

  for (const item of pending) {
    if (!navigator.onLine) {
      // No point trying if we know we are offline.
      break;
    }
    await db.pendingSets.update(item.localId, { status: 'syncing' });

    try {
      const payload = {
        exerciseId: item.exerciseId,
        gymEquipmentId: item.gymEquipmentId ?? null,
        setNumber: item.setNumber,
        weight: item.weight,
        reps: item.reps,
        rir: item.rir,
        durationSec: item.durationSec ?? null,
        distanceM: item.distanceM ?? null,
        notes: item.notes,
        isWarmup: item.isWarmup,
        isDropSet: item.isDropSet,
      };
      const post = (gymEquipmentId: string | null) =>
        fetch(`/api/sessions/${item.sessionId}/sets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, gymEquipmentId }),
        });

      let res = await post(payload.gymEquipmentId);
      // Equipment is optional metadata. If a server version rejects a stale
      // reference with 400, retry once without it so the actual queued set is
      // never stranded by an inventory decoration.
      if (res.status === 400 && payload.gymEquipmentId) {
        res = await post(null);
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        // If the session is closed or the exercise invalid, retrying is
        // pointless: we mark it failed so we do not loop. The user can manually
        // purge the queue later if needed.
        const fatal = res.status === 400 || res.status === 404;
        await db.pendingSets.update(item.localId, {
          status: fatal ? 'failed' : 'pending',
          attempts: (item.attempts ?? 0) + 1,
          lastError: data?.error ?? `HTTP ${res.status}`,
        });
        failed += 1;
        continue;
      }

      const created = (await res.json()) as { id: string; gymEquipmentId?: string | null };
      // The server degrades a stale/foreign equipment reference to null rather
      // than rejecting the set (issue #313). Mirror that on the local record so
      // the next set does not pre-select a machine that was never attached, and
      // report it so the UI can tell the user (issue #326).
      const sentEquipmentId = payload.gymEquipmentId;
      const equipmentDropped = sentEquipmentId !== null && !created.gymEquipmentId;
      await db.pendingSets.update(item.localId, {
        status: 'synced',
        serverId: created.id,
        syncedAt: Date.now(),
        lastError: null,
        // Written before the broadcast below, so a listener that drains
        // immediately still finds the record it is being told about.
        ...(equipmentDropped
          ? { gymEquipmentId: null, equipmentDroppedNotice: sentEquipmentId }
          : {}),
      });
      if (equipmentDropped) {
        droppedEquipment.push({
          localId: item.localId,
          sessionId: item.sessionId,
          gymEquipmentId: sentEquipmentId,
        });
      }
      flushed += 1;
    } catch (err) {
      // Network error (offline, timeout): we keep 'pending' to retry later.
      await db.pendingSets.update(item.localId, {
        status: 'pending',
        attempts: (item.attempts ?? 0) + 1,
        lastError: err instanceof Error ? err.message : 'network',
      });
      failed += 1;
    }
  }

  const remaining = await db.pendingSets.where('status').anyOf(['pending', 'failed']).count();
  if (droppedEquipment.length > 0) {
    for (const listener of droppedEquipmentListeners) {
      listener(droppedEquipment);
    }
  }
  return { flushed, failed, pending: remaining, droppedEquipment };
}

// Helper: adds a set to the queue (status pending) and triggers a flush.
export async function queueSet(
  set: Omit<
    PendingSet,
    'createdAt' | 'status' | 'serverId' | 'syncedAt' | 'attempts' | 'lastError'
  >,
): Promise<PendingSet> {
  const db = getDB();
  const record: PendingSet = {
    ...set,
    createdAt: Date.now(),
    status: 'pending',
    serverId: null,
    syncedAt: null,
    attempts: 0,
    lastError: null,
  };
  await db.pendingSets.add(record);
  // Kick off the flush in the background (not awaited so as not to block the UI).
  void flushPendingSets();
  return record;
}

// Returns the equipment drops recorded for `sessionId` that nobody has shown
// yet, and clears them so they are shown exactly once (issue #337).
//
// This is the single consumer of a drop. `onEquipmentDropped` stays a *signal*
// that something changed rather than the payload itself, because a flush can
// finish while no SessionRunner is mounted — log a set offline, close the app,
// reopen on the dashboard — and a broadcast with no listener was lost. Draining
// on mount picks up exactly those, and draining on the signal covers the live
// in-session case, with the clear making the two paths idempotent rather than
// double-reporting.
//
// It also removes the ordering dependency in `SessionRunner`, where
// `bindAutoSync()` runs just before `onEquipmentDropped` registers and was only
// safe because `flushPendingSets` happens to suspend at its first `await`.
export async function drainDroppedEquipment(sessionId: string): Promise<DroppedEquipment[]> {
  const db = getDB();
  const rows = await db.pendingSets.where('sessionId').equals(sessionId).toArray();
  const dropped = rows.filter((row) => row.equipmentDroppedNotice != null);

  // Read out before clearing. `toArray()` hands back copies under Dexie, so
  // mapping afterwards would happen to work — but it reads the field this call
  // is about to null, which is only correct by accident of the driver.
  const notices: DroppedEquipment[] = dropped.map((row) => ({
    localId: row.localId,
    sessionId: row.sessionId,
    gymEquipmentId: row.equipmentDroppedNotice as string,
  }));

  // Cleared before returning: a caller that throws while rendering the notice
  // loses it, which is the same failure as today, whereas clearing afterwards
  // could show it twice on a re-entrant drain.
  await Promise.all(
    dropped.map((row) => db.pendingSets.update(row.localId, { equipmentDroppedNotice: null })),
  );

  return notices;
}

// Deletes synced sets older than `maxAgeMs` to keep Dexie lightweight.
export async function pruneSyncedSets(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = getDB();
  const cutoff = Date.now() - maxAgeMs;
  return db.pendingSets
    .where('status')
    .equals('synced')
    .and((s) => (s.syncedAt ?? 0) < cutoff)
    .delete();
}

// Hook event listener to start/stop the auto-sync on online/offline.
export function bindAutoSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => {
    void flushPendingSets();
  };
  window.addEventListener('online', onOnline);
  // First flush on mount (in case some sets remain from the previous session).
  if (navigator.onLine) {
    void flushPendingSets();
  }
  return () => window.removeEventListener('online', onOnline);
}
