import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Integration tests run against a real Postgres (see docker-compose.test.yml).
// DATABASE_URL must point at the test database (the test:integration script
// sets it). Kept separate from the unit/component config (jsdom).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/integration/setup.ts'],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
