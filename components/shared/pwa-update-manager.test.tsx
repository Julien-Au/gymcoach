import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isServiceWorkerUpdate, PwaUpdateManager } from './pwa-update-manager';

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

afterEach(() => {
  if (originalServiceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
  } else {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  }
  vi.restoreAllMocks();
});

function installServiceWorkerMock(controller: ServiceWorker | null = {} as ServiceWorker) {
  const update = vi.fn().mockResolvedValue(undefined);
  const registration = { update } as unknown as ServiceWorkerRegistration;
  const listeners = new Map<string, EventListener>();
  const serviceWorker = {
    controller,
    ready: Promise.resolve(registration),
    getRegistration: vi.fn().mockResolvedValue(registration),
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') listeners.set(type, listener);
    }),
    removeEventListener: vi.fn(),
  } as unknown as ServiceWorkerContainer;

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker,
  });

  return { serviceWorker, update, listeners };
}

describe('PwaUpdateManager', () => {
  it('checks for an updated worker and listens for controller changes', async () => {
    const { serviceWorker, update } = installServiceWorkerMock();
    const view = render(<PwaUpdateManager />);

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(serviceWorker.addEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
    );

    view.unmount();
    expect(serviceWorker.removeEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
    );
  });

  it('distinguishes an update from the initial service-worker install', () => {
    expect(isServiceWorkerUpdate({} as ServiceWorker)).toBe(true);
    expect(isServiceWorkerUpdate(null)).toBe(false);
  });
});
