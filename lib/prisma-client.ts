// Stable, browser-safe re-export of the generated Prisma 7 client surface.
//
// Prisma 7 replaced the legacy `prisma-client-js` generator (which emitted into
// node_modules/@prisma/client) with the `prisma-client` generator that emits to
// an explicit output path - here `prisma/generated`. That generator splits the
// output in two: `client.ts` carries the runtime PrismaClient (and pulls in
// node:fs etc., so it can only run server-side) while `browser.ts` carries the
// model types, the enums (WeightUnit, MuscleGroup, ...) and the `Prisma` type
// namespace with NO runtime - safe to bundle into client components.
//
// The whole app imports its Prisma types and enums from this one barrel, which
// points at the browser-safe surface so a 'use client' component pulling in an
// enum never drags the server runtime into the browser bundle. The handful of
// server-only modules that need a runtime value (the PrismaClient class in
// lib/db.ts and the seeds, or Prisma.PrismaClientKnownRequestError in lib/api.ts)
// import directly from '@/prisma/generated/client' instead.
export * from '@/prisma/generated/browser';
