// ============================================================
// Sync queue : flush les sets pending vers l'API
// ============================================================
// Stratégie :
// 1. Quand une série est validée localement, on l'écrit dans IndexedDB
//    (status='pending') et on déclenche un flush.
// 2. flushPendingSets() prend chaque pending dans l'ordre, tente le POST
//    et marque selon résultat.
// 3. Au démarrage de l'app + sur l'event 'online', on appelle flushPendingSets().
// 4. Pas de retry agressif : on attend le prochain trigger (online, validation,
//    démarrage). Si tu coupes le wifi en plein milieu, l'app retentera quand
//    le réseau revient. Pas de timer en arrière-plan pour économiser la batterie.

import { getDB, type PendingSet } from '@/lib/indexeddb';

export interface FlushResult {
  flushed: number;
  failed: number;
  pending: number;
}

let inFlight: Promise<FlushResult> | null = null;

export async function flushPendingSets(): Promise<FlushResult> {
  // Re-entrancy : si un flush est déjà en cours, on retourne sa promesse.
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
      // Pas la peine d'essayer si on sait qu'on est offline.
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
        // Si la session est clôturée ou l'exo invalide, le retry est inutile :
        // on marque failed pour ne pas boucler. L'utilisateur peut purger
        // manuellement la queue plus tard si besoin.
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
      // Erreur réseau (offline, timeout) : on garde 'pending' pour retry plus tard.
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

// Helper : ajoute un set en queue (status pending) et déclenche un flush.
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
  // Lance le flush en background (pas await pour ne pas bloquer l'UI).
  void flushPendingSets();
  return record;
}

// Supprime les sets syncés plus vieux que `maxAgeMs` pour garder Dexie léger.
export async function pruneSyncedSets(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = getDB();
  const cutoff = Date.now() - maxAgeMs;
  return db.pendingSets
    .where('status')
    .equals('synced')
    .and((s) => (s.syncedAt ?? 0) < cutoff)
    .delete();
}

// Hook event listener pour démarrer/arrêter l'auto-sync sur online/offline.
export function bindAutoSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => {
    void flushPendingSets();
  };
  window.addEventListener('online', onOnline);
  // Premier flush au montage (au cas où des sets restent de la session précédente).
  if (navigator.onLine) {
    void flushPendingSets();
  }
  return () => window.removeEventListener('online', onOnline);
}
