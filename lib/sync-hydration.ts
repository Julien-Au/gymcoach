// Hydrate IndexedDB avec les sets fetchés depuis le serveur.
// Idempotent : utilise localId = "srv_${serverId}" comme clé primaire,
// donc relancer la fonction ne crée pas de doublons.
//
// Stratégie : à chaque mount du SessionRunner, on appelle hydrate avec
// les sets server-side. IndexedDB devient ainsi la source de vérité unique
// pour l'affichage (les composants utilisent useLiveQuery sur Dexie).

import type { Set as PrismaSet } from '@prisma/client';
import { getDB, type PendingSet } from '@/lib/indexeddb';

export async function hydrateFromServerSets(
  sessionId: string,
  serverSets: PrismaSet[],
): Promise<void> {
  const db = getDB();
  const records: PendingSet[] = serverSets.map((s) => ({
    localId: `srv_${s.id}`,
    sessionId,
    exerciseId: s.exerciseId,
    setNumber: s.setNumber,
    weight: s.weight,
    reps: s.reps,
    rir: s.rir,
    notes: s.notes,
    isWarmup: s.isWarmup,
    isDropSet: s.isDropSet,
    createdAt: new Date(s.completedAt).getTime(),
    status: 'synced',
    serverId: s.id,
    syncedAt: new Date(s.completedAt).getTime(),
    attempts: 0,
    lastError: null,
  }));
  // bulkPut est idempotent par localId.
  await db.pendingSets.bulkPut(records);
}
