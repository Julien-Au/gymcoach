import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Ratchet for issue #317: every API route addressed by a resource id must be
// referenced by an ownership-aware integration test, so a new [id] route
// cannot ship without a cross-user case and an existing one cannot silently
// lose its coverage. This test needs no database; it only reads the tree.

const ROOT = process.cwd();
const API_DIR = join(ROOT, 'app', 'api');

// Routes whose cross-user coverage lives in a dedicated suite instead of
// route-ownership.test.ts. The mapped file must exist AND reference the
// route; the quality of its cross-user assertions is review's job.
const COVERED_ELSEWHERE: Record<string, string> = {
  'app/api/bodyweight/[id]/route.ts': 'tests/integration/bodyweight-route.test.ts',
  'app/api/goals/[id]/route.ts': 'tests/integration/goals-route.test.ts',
  'app/api/measurements/[id]/route.ts': 'tests/integration/measurements-route.test.ts',
  'app/api/gym-equipment/[id]/route.ts': 'tests/integration/gym-equipment-api.test.ts',
  'app/api/gym-equipment/[id]/image/route.ts': 'tests/integration/gym-equipment-api.test.ts',
  'app/api/gyms/[id]/equipment/route.ts': 'tests/integration/gym-equipment-api.test.ts',
  'app/api/progress-photos/[id]/route.ts': 'tests/integration/progress-photos-route.test.ts',
  'app/api/progress-photos/[id]/image/route.ts': 'tests/integration/progress-photos-route.test.ts',
};

function findIdRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findIdRoutes(full));
    } else if (entry.name === 'route.ts' && full.includes('[id]')) {
      out.push(relative(ROOT, full));
    }
  }
  return out;
}

describe('ownership-test coverage ratchet (issue #317)', () => {
  const idRoutes = findIdRoutes(API_DIR);
  const ownershipSource = readFileSync(
    join(ROOT, 'tests', 'integration', 'route-ownership.test.ts'),
    'utf8',
  );

  it('finds the [id] routes (sanity: the glob is not silently empty)', () => {
    expect(idRoutes.length).toBeGreaterThanOrEqual(10);
  });

  it.each(idRoutes)('%s is referenced by an ownership-aware test', (routePath) => {
    // Import specifiers drop the .ts extension.
    const specifier = routePath.replace(/\.ts$/, '');
    if (ownershipSource.includes(specifier)) return;
    const mapped = COVERED_ELSEWHERE[routePath];
    if (!mapped) {
      throw new Error(
        `${routePath} is not referenced by route-ownership.test.ts and has no ` +
          `COVERED_ELSEWHERE entry. Add a cross-user case for it (or map its ` +
          `dedicated suite here).`,
      );
    }
    const mappedSource = readFileSync(join(ROOT, mapped), 'utf8');
    expect(
      mappedSource.includes(specifier),
      `${mapped} no longer references ${routePath}; its coverage claim is stale.`,
    ).toBe(true);
  });
});
