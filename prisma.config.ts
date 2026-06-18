// Prisma 7 moved CLI configuration out of the package.json "prisma" key into a
// dedicated config file. This wires the schema location, the migrations folder,
// the seed command (was package.json#prisma.seed), and the datasource URL used
// by migration/introspection commands (the schema no longer carries `url`).
//
// With a config file present Prisma no longer auto-loads .env, so we load it for
// local CLI runs using Node's built-in env-file loader (no dotenv dependency).
// In CI and the production image DATABASE_URL is already in the environment and
// there is no .env file, so the guard makes this a no-op there.
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read directly from the environment rather than prisma/config's `env()`
    // helper: `env()` throws eagerly when the variable is absent, which breaks
    // `prisma generate` at image-build time (no DATABASE_URL, and generate does
    // not need one). It is undefined only for commands that never connect;
    // migrate/seed run with DATABASE_URL set.
    url: process.env.DATABASE_URL,
  },
});
