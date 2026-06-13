import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { buildCoachPayload } from '@/lib/coach';

// Free-text note to the coach (issue #188): the User.coachNote column rides the
// existing profile route. Pinned here: set and clear through PATCH /api/profile,
// the trim-to-null semantics, the 500-char Zod bound, ownership scoping, and
// that buildCoachPayload carries the note (null = absent) per user.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as getProfile, PATCH as patchProfile } from '@/app/api/profile/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

function jsonReq(method: string, body: unknown): Request {
  return new Request('http://test.local/api/profile', {
    method,
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

describe('profile route - coachNote (issue #188)', () => {
  it('sets the note, returns it on GET, and clears it with null', async () => {
    const user = await seedUser('coachnote-set@test.dev');
    actAs(user.id);

    const setRes = await patchProfile(
      jsonReq('PATCH', { coachNote: 'Shoulder is bothering me, go easy on pressing.' }),
    );
    expect(setRes.status).toBe(200);
    expect((await setRes.json()).coachNote).toBe(
      'Shoulder is bothering me, go easy on pressing.',
    );

    const getRes = await getProfile();
    expect((await getRes.json()).coachNote).toBe(
      'Shoulder is bothering me, go easy on pressing.',
    );

    // null clears it.
    const clearRes = await patchProfile(jsonReq('PATCH', { coachNote: null }));
    expect(clearRes.status).toBe(200);
    expect((await clearRes.json()).coachNote).toBeNull();
  });

  it('trims, and stores a whitespace-only note as null (a clear, not "")', async () => {
    const user = await seedUser('coachnote-trim@test.dev');
    actAs(user.id);

    const padded = await patchProfile(jsonReq('PATCH', { coachNote: '  ill last week  ' }));
    expect((await padded.json()).coachNote).toBe('ill last week');

    const blank = await patchProfile(jsonReq('PATCH', { coachNote: '   ' }));
    expect((await blank.json()).coachNote).toBeNull();
  });

  it('rejects a note over 500 characters (Zod bound)', async () => {
    const user = await seedUser('coachnote-bound@test.dev');
    actAs(user.id);

    const res = await patchProfile(
      jsonReq('PATCH', { coachNote: 'a'.repeat(501) }),
    );
    expect(res.status).toBe(400);
    // Exactly 500 is accepted.
    const ok = await patchProfile(jsonReq('PATCH', { coachNote: 'a'.repeat(500) }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).coachNote).toHaveLength(500);
  });

  it('leaves the note untouched when the field is absent from the patch', async () => {
    const user = await seedUser('coachnote-absent@test.dev');
    actAs(user.id);

    await patchProfile(jsonReq('PATCH', { coachNote: 'keep me' }));
    // A patch that does not mention coachNote must preserve it.
    const other = await patchProfile(jsonReq('PATCH', { weeklyFrequency: 4 }));
    expect((await other.json()).coachNote).toBe('keep me');
  });

  it('is ownership-scoped: a patch only touches the acting user', async () => {
    const a = await seedUser('coachnote-a@test.dev');
    const b = await seedUser('coachnote-b@test.dev');

    actAs(a.id);
    await patchProfile(jsonReq('PATCH', { coachNote: 'A note' }));
    actAs(b.id);
    await patchProfile(jsonReq('PATCH', { coachNote: 'B note' }));

    const aRow = await db.user.findUnique({ where: { id: a.id }, select: { coachNote: true } });
    const bRow = await db.user.findUnique({ where: { id: b.id }, select: { coachNote: true } });
    expect(aRow?.coachNote).toBe('A note');
    expect(bRow?.coachNote).toBe('B note');
  });
});

describe('buildCoachPayload - coachNote (issue #188)', () => {
  it('carries the note per user; null when absent', async () => {
    const withNote = await seedUser('payload-note@test.dev');
    await db.user.update({
      where: { id: withNote.id },
      data: { coachNote: 'travelling, expect missed sessions' },
    });
    const without = await seedUser('payload-nonote@test.dev');

    const payloadWith = await buildCoachPayload(withNote.id);
    expect(payloadWith.userProfile.coachNote).toBe('travelling, expect missed sessions');

    const payloadWithout = await buildCoachPayload(without.id);
    expect(payloadWithout.userProfile.coachNote).toBeNull();
  });
});
