'use client';

import { useEffect } from 'react';

export function isServiceWorkerUpdate(previousController: ServiceWorker | null): boolean {
  return previousController !== null;
}

export function PwaUpdateManager() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let controller = navigator.serviceWorker.controller;
    let reloadPending = false;
    let reloading = false;

    function reloadForUpdate() {
      if (reloading) return;
      if (document.visibilityState === 'hidden') {
        reloadPending = true;
        return;
      }

      reloading = true;
      window.location.reload();
    }

    function handleControllerChange() {
      // A controller appearing for the first time is the initial PWA install,
      // not an update to a page that is already running.
      if (!isServiceWorkerUpdate(controller)) {
        controller = navigator.serviceWorker.controller;
        return;
      }

      reloadForUpdate();
    }

    async function checkForUpdate() {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      } catch {
        // Updates are best-effort; offline mode continues through Workbox caches.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (reloadPending) {
        reloadForUpdate();
        return;
      }
      void checkForUpdate();
    }

    function handleOnline() {
      void checkForUpdate();
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    void navigator.serviceWorker.ready
      .then((registration) => registration.update())
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return null;
}
