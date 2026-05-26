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

  for (const item of pending) {
    if (!navigator.onLine) {
      // No point trying if we know we are offline.
      break;
    }
    await db.pendingSets.update(item.localId, { status: 'syncing' });

    try {
      const res = await fetch(`/api/sessions/${item.sessionId}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId: item.exerciseId,
          setNumber: item.setNumber,
          weight: item.weight,
          reps: item.reps,
          rir: item.rir,
          notes: item.notes,
          isWarmup: item.isWarmup,
          isDropSet: item.isDropSet,
        }),
      });

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

      const created = (await res.json()) as { id: string };
      await db.pendingSets.update(item.localId, {
        status: 'synced',
        serverId: created.id,
        syncedAt: Date.now(),
        lastError: null,
      });
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
  return { flushed, failed, pending: remaining };
}

// Helper: adds a set to the queue (status pending) and triggers a flush.
export async function queueSet(
  set: Omit<PendingSet, 'createdAt' | 'status' | 'serverId' | 'syncedAt' | 'attempts' | 'lastError'>,
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
