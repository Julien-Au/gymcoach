import { describe, it, expect, vi, afterEach } from 'vitest';
import { clearSessionCaches } from './pwa-cache';

function stubCaches(names: string[]) {
  const deleteMock = vi.fn().mockResolvedValue(true);
  vi.stubGlobal('caches', {
    keys: vi.fn().mockResolvedValue(names),
    delete: deleteMock,
  });
  return deleteMock;
}

describe('clearSessionCaches', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deletes the session-scoped buckets and keeps shared caches', async () => {
    const deleteMock = stubCaches([
      'api-get',
      'pages',
      'start-url',
      'static-assets',
      'workbox-precache-v2-https://gymcoach.local/',
    ]);

    await clearSessionCaches();

    expect(deleteMock.mock.calls.map((call) => call[0]).sort()).toEqual([
      'api-get',
      'pages',
      'start-url',
    ]);
    expect(deleteMock).not.toHaveBeenCalledWith('static-assets');
  });

  it('matches the runtime cache names by prefix', async () => {
    const deleteMock = stubCaches(['api-get-v2', 'pages-backup', 'static-assets']);

    await clearSessionCaches();

    expect(deleteMock.mock.calls.map((call) => call[0]).sort()).toEqual([
      'api-get-v2',
      'pages-backup',
    ]);
  });

  it('resolves without touching anything when CacheStorage is unavailable', async () => {
    // jsdom does not implement window.caches; nothing is stubbed here.
    await expect(clearSessionCaches()).resolves.toBeUndefined();
  });
});
