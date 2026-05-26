const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Désactivé en dev pour éviter le caching agressif pendant le hot-reload.
  disable: process.env.NODE_ENV === 'development',
  // On ne pré-cache pas les routes API : trop volatiles et auth-dépendantes.
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
  runtimeCaching: [
    {
      // Pages applicatives : NetworkFirst, fallback cache si offline.
      urlPattern: ({ request, url }) =>
        request.mode === 'navigate' && !url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      // API GET : NetworkFirst (programmes, sessions, exos changent dans le temps).
      urlPattern: ({ url, request }) =>
        url.pathname.startsWith('/api/') && request.method === 'GET',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-get',
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      // Assets statiques : CacheFirst (longue durée).
      urlPattern: ({ url }) =>
        url.pathname.startsWith('/_next/static/') ||
        /\.(?:png|svg|webp|ico|woff2?)$/.test(url.pathname),
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
