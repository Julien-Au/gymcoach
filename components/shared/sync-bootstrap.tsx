'use client';

import { useEffect } from 'react';
import { bindAutoSync, pruneSyncedSets } from '@/lib/sync';

// Composant invisible qui démarre la sync automatique au mount.
// Vit dans le layout (app)/, donc actif sur toutes les routes protégées.
// - Au mount : flush si online + listener pour l'event 'online'.
// - Au mount : purge des sets syncés > 7 jours pour garder Dexie léger.
export function SyncBootstrap() {
  useEffect(() => {
    const cleanup = bindAutoSync();
    void pruneSyncedSets();
    return cleanup;
  }, []);
  return null;
}
