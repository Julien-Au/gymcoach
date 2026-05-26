// Wrapper Wake Lock API (empêche l'écran de s'éteindre pendant une séance).
// Le navigateur libère automatiquement le lock quand l'onglet perd le focus.
// Il faut donc le réacquérir au retour via visibilitychange.

let currentLock: WakeLockSentinel | null = null;

export async function acquireWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  try {
    currentLock = await navigator.wakeLock.request('screen');
  } catch (err) {
    // Pas bloquant : l'utilisateur peut toujours forcer l'écran allumé.
    console.warn('Wake Lock request failed:', err);
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await currentLock?.release();
  } catch {
    // Ignore : le lock peut déjà être libéré par le navigateur.
  }
  currentLock = null;
}

// À utiliser dans un useEffect côté composant :
//   const cleanup = bindWakeLockToVisibility();
//   acquireWakeLock();
//   return () => { releaseWakeLock(); cleanup(); };
export function bindWakeLockToVisibility(): () => void {
  if (typeof document === 'undefined') return () => {};
  const handler = () => {
    if (document.visibilityState === 'visible' && currentLock === null) {
      void acquireWakeLock();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
