import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaUpdateManager } from './pwa-update-manager';

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');

afterEach(() => {
  cleanup();
  if (originalServiceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
  } else {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  }
  if (originalVisibilityState) {
    Object.defineProperty(document, 'visibilityState', originalVisibilityState);
  }
  vi.restoreAllMocks();
});

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
}

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
  it('checks for updates and removes all listeners on unmount', async () => {
    const { serviceWorker, update } = installServiceWorkerMock();
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    const windowRemove = vi.spyOn(window, 'removeEventListener');
    const view = render(<PwaUpdateManager reloadPage={vi.fn()} />);

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
    expect(documentRemove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(windowRemove).toHaveBeenCalledWith('online', expect.any(Function));
  });

  it('ignores the initial controller install but reloads for a replacement controller', () => {
    const initial = installServiceWorkerMock(null);
    const reloadInitial = vi.fn();
    const firstView = render(<PwaUpdateManager reloadPage={reloadInitial} />);

    (initial.serviceWorker as { controller: ServiceWorker | null }).controller =
      {} as ServiceWorker;
    act(() => initial.listeners.get('controllerchange')?.(new Event('controllerchange')));
    expect(reloadInitial).not.toHaveBeenCalled();
    firstView.unmount();

    const replacement = installServiceWorkerMock({} as ServiceWorker);
    const reloadReplacement = vi.fn();
    render(<PwaUpdateManager reloadPage={reloadReplacement} />);

    act(() => replacement.listeners.get('controllerchange')?.(new Event('controllerchange')));
    expect(reloadReplacement).toHaveBeenCalledTimes(1);
  });

  it('defers a replacement reload while hidden and reloads when visibility returns', () => {
    setVisibilityState('hidden');
    const { listeners } = installServiceWorkerMock({} as ServiceWorker);
    const reload = vi.fn();
    render(<PwaUpdateManager reloadPage={reload} />);

    act(() => listeners.get('controllerchange')?.(new Event('controllerchange')));
    expect(reload).not.toHaveBeenCalled();

    setVisibilityState('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('checks for updates again when the page becomes visible or comes online', async () => {
    setVisibilityState('hidden');
    const { serviceWorker, update } = installServiceWorkerMock({} as ServiceWorker);
    render(<PwaUpdateManager reloadPage={vi.fn()} />);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    update.mockClear();

    setVisibilityState('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(serviceWorker.getRegistration).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    (serviceWorker.getRegistration as ReturnType<typeof vi.fn>).mockClear();
    update.mockClear();
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(serviceWorker.getRegistration).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  });
});
