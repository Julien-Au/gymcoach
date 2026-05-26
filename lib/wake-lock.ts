// Wake Lock API wrapper (prevents the screen from turning off during a session).
// The browser automatically releases the lock when the tab loses focus.
// It must therefore be re-acquired on return via visibilitychange.

let currentLock: WakeLockSentinel | null = null;

export async function acquireWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  try {
    currentLock = await navigator.wakeLock.request('screen');
  } catch (err) {
    // Non-blocking: the user can still force the screen to stay on.
    console.warn('Wake Lock request failed:', err);
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await currentLock?.release();
  } catch {
    // Ignore: the lock may already be released by the browser.
  }
  currentLock = null;
}

// To use in a useEffect on the component side:
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
