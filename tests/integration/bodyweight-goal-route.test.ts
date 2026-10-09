import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Bodyweight goal (issue #398): the User.bodyweightGoalKg column rides the
// existing profile route. Pinned here: set and clear through PATCH
// /api/profile, the Zod bounds, and that one user's write never touches
// another user's goal.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as getProfile, PATCH as patchProfile } from '@/app/api/profile/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function patch(body: unknown): Request {
  return new Request('http://test.local/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function seedUser(email: string) {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('profile route - bodyweightGoalKg (issue #398)', () => {
  it('sets the goal, returns it on GET, and clears it with null', async () => {
    const user = await seedUser('bwgoal-set@test.dev');
    actAs(user.id);

    const setRes = await patchProfile(patch({ bodyweightGoalKg: 75.5 }));
    expect(setRes.status).toBe(200);
    expect((await setRes.json()).bodyweightGoalKg).toBe(75.5);
    expect((await (await getProfile()).json()).bodyweightGoalKg).toBe(75.5);

    const clearRes = await patchProfile(patch({ bodyweightGoalKg: null }));
    expect(clearRes.status).toBe(200);
    expect((await clearRes.json()).bodyweightGoalKg).toBeNull();
  });

  it('leaves the goal alone when another profile field is saved', async () => {
    const user = await seedUser('bwgoal-keep@test.dev');
    actAs(user.id);
    await patchProfile(patch({ bodyweightGoalKg: 80 }));

    const res = await patchProfile(patch({ displayName: 'Sam' }));
    expect(res.status).toBe(200);
    expect((await res.json()).bodyweightGoalKg).toBe(80);
  });

  it('rejects a goal outside the bodyweight bounds without writing', async () => {
    const user = await seedUser('bwgoal-bounds@test.dev');
    actAs(user.id);

    for (const bad of [10, 400, 'eighty']) {
      const res = await patchProfile(patch({ bodyweightGoalKg: bad }));
      expect(res.status).toBe(400);
    }
    const row = await db.user.findUnique({ where: { id: user.id } });
    expect(row?.bodyweightGoalKg).toBeNull();
  });

  it("only writes the caller's own goal", async () => {
    const owner = await seedUser('bwgoal-owner@test.dev');
    const other = await seedUser('bwgoal-other@test.dev');
    actAs(owner.id);

    await patchProfile(patch({ bodyweightGoalKg: 70 }));

    const otherRow = await db.user.findUnique({ where: { id: other.id } });
    expect(otherRow?.bodyweightGoalKg).toBeNull();
  });
});
