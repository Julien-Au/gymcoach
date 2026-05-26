import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // plugin-react transforms JSX/TSX in test files regardless of the
  // tsconfig `jsx: preserve` setting used by Next.js.
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    // Logic tests live next to lib/ code, component tests under components/.
    include: ['lib/**/*.test.ts', 'components/**/*.test.{ts,tsx}'],
    // jsdom covers both: pure logic tests run fine in it too.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
});
