// CacheStorage buckets written by the Workbox runtime caches declared in
// next.config.js (`api-get`, `pages`) plus `start-url`, the bucket
// @ducanh2912/next-pwa uses for the cached start page. Prefix matching mirrors
// the locale-switch cleanup in components/shared/language-selector.tsx.
const SESSION_SCOPED_CACHE_PREFIXES = ['api-get', 'pages', 'start-url'];

// Deletes every session-scoped CacheStorage bucket. Each of them can hold data
// tied to the signed-in user (cached GET /api/* responses and page documents),
// so they must not survive logout: on a shared device the next sign-in would
// otherwise be served the previous user's responses until the entries expire.
// No-op where CacheStorage is unavailable (SSR, non-secure contexts).
export async function clearSessionCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  const cacheNames = await window.caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) =>
        SESSION_SCOPED_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)),
      )
      .map((name) => window.caches.delete(name)),
  );
}
