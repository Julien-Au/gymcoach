'use client';

import { useEffect, useState } from 'react';
import { CloudOff, RotateCw, Wifi } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@/lib/indexeddb';
import { flushPendingSets } from '@/lib/sync';
import { Button } from '@/components/ui/button';

// Indicateur global online/offline + queue de sync.
// 3 états visuels :
// - Online + 0 pending : rien (silencieux pour ne pas polluer la nav).
// - Online + N pending : badge "Synchro N..." avec bouton retry manuel.
// - Offline (avec ou sans pending) : badge orange "Hors ligne · N en attente".
//
// Le composant est silencieux pendant l'hydratation initiale (avant que
// IndexedDB ait été ouvert) pour éviter un flash "0 pending".

export function OfflineIndicator() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const pendingCount = useLiveQuery(
    async () => {
      try {
        return await getDB().pendingSets.where('status').anyOf(['pending', 'syncing', 'failed']).count();
      } catch {
        return 0;
      }
    },
    [],
    0,
  );

  if (online === null) return null;

  // Online + queue vide : invisible.
  if (online && pendingCount === 0) return null;

  async function handleManualSync() {
    setFlushing(true);
    try {
      await flushPendingSets();
    } finally {
      setFlushing(false);
    }
  }

  if (!online) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
        <CloudOff className="size-3.5" />
        <span>
          Hors ligne{pendingCount > 0 ? ` · ${pendingCount} en attente` : ''}
        </span>
      </div>
    );
  }

  // Online avec queue résiduelle : on affiche en mode info, avec retry manuel.
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleManualSync}
      disabled={flushing}
      className="h-7 gap-1.5 px-2 text-xs"
      aria-label="Synchroniser maintenant"
    >
      {flushing ? (
        <RotateCw className="size-3.5 animate-spin" />
      ) : (
        <Wifi className="size-3.5" />
      )}
      <span>Synchro {pendingCount}...</span>
    </Button>
  );
}
