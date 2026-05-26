'use client';

import { useEffect } from 'react';
import { bindAutoSync, pruneSyncedSets } from '@/lib/sync';

// Invisible component that starts automatic sync on mount.
// Lives in the (app)/ layout, so it is active on all protected routes.
// - On mount: flush if online + listener for the 'online' event.
// - On mount: prune synced sets older than 7 days to keep Dexie lean.
export function SyncBootstrap() {
  useEffect(() => {
    const cleanup = bindAutoSync();
    void pruneSyncedSets();
    return cleanup;
  }, []);
  return null;
}
