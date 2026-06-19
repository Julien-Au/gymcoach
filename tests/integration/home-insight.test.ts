import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { getHomeInsight } from '@/lib/home-insight';

// Fixed "now" so the ISO-week / 12-week-window math is deterministic.
// 2026-06-17 is a Wednesday; the ISO week starts Monday 2026-06-15.
const NOW = new Date('2026-06-17T12:00:00.000Z');
const THIS_WEEK = new Date('2026-06-16T18:00:00.000Z'); // Tue, same ISO week as NOW
function weeksAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 7 * 24 * 60 * 60 * 1000);
}

async function makeUser(email: string) {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

async function makeExercise(userId: string, name: string) {
  return db.exercise.create({
    data: { userId, name, muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
}

// One finished session at `at` with a single working set of (weight x reps).
async function logSession(
  userId: string,
  exerciseId: string,
  at: Date,
  weight: number,
  reps: number,
) {
  const session = await db.session.create({
    data: { userId, startedAt: at, finishedAt: new Date(at.getTime() + 3600_000) },
  });
  await db.set.create({
    data: {
      sessionId: session.id,
      exerciseId,
      setNumber: 1,
      weight,
      reps,
      isWarmup: false,
      completedAt: at,
    },
  });
  return session;
}

describe('getHomeInsight (issue #237, server)', () => {
  it('returns null for a brand-new account with no history', async () => {
    const user = await makeUser('hi-empty@test.dev');
    expect(await getHomeInsight(user.id, NOW)).toBeNull();
  });

  it('surfaces a fresh PR when the most recent session sets a new best', async () => {
    const user = await makeUser('hi-pr@test.dev');
    const bench = await makeExercise(user.id, 'Bench');
    await logSession(user.id, bench.id, weeksAgo(2), 100, 5);
    await logSession(user.id, bench.id, THIS_WEEK, 110, 5); // heavier -> PR dated to last session

    const insight = await getHomeInsight(user.id, NOW);
    expect(insight?.kind).toBe('pr');
    expect(insight?.detail).toContain('Bench');
  });

  it('surfaces a stalled lift (one stall does not trigger a deload)', async () => {
    const user = await makeUser('hi-stall@test.dev');
    const bench = await makeExercise(user.id, 'Bench');
    // Three flat sessions -> e1RM never improves -> stalled. Equal loads mean
    // the record is dated to the FIRST session, so no fresh PR competes.
    await logSession(user.id, bench.id, weeksAgo(3), 100, 5);
    await logSession(user.id, bench.id, weeksAgo(2), 100, 5);
    await logSession(user.id, bench.id, weeksAgo(1), 100, 5);

    const insight = await getHomeInsight(user.id, NOW);
    expect(insight?.kind).toBe('stall');
    expect(insight?.title).toBe('A lift has stalled');
    expect(insight?.detail).toContain('Bench');
  });

  it('recommends a deload when two or more lifts have stalled', async () => {
    const user = await makeUser('hi-deload@test.dev');
    const bench = await makeExercise(user.id, 'Bench');
    const squat = await makeExercise(user.id, 'Squat');
    for (const ex of [bench, squat]) {
      await logSession(user.id, ex.id, weeksAgo(3), 100, 5);
      await logSession(user.id, ex.id, weeksAgo(2), 100, 5);
      await logSession(user.id, ex.id, weeksAgo(1), 100, 5);
    }

    const insight = await getHomeInsight(user.id, NOW);
    expect(insight?.kind).toBe('deload');
  });

  it('falls back to an on-track line when there is recent training but no stall/PR', async () => {
    const user = await makeUser('hi-ontrack@test.dev');
    const bench = await makeExercise(user.id, 'Bench');
    // Heaviest set is in the older session, so the recent (this-week) session is
    // not a PR; only two sessions, so nothing is stalled.
    await logSession(user.id, bench.id, weeksAgo(2), 110, 5);
    await logSession(user.id, bench.id, THIS_WEEK, 100, 5);

    const insight = await getHomeInsight(user.id, NOW);
    expect(insight?.kind).toBe('on-track');
    expect(insight?.detail).toContain('this week');
  });

  it('is scoped to the user (another account does not leak in)', async () => {
    const owner = await makeUser('hi-owner@test.dev');
    const stranger = await makeUser('hi-stranger@test.dev');
    const strangerBench = await makeExercise(stranger.id, 'Bench');
    await logSession(stranger.id, strangerBench.id, THIS_WEEK, 100, 5);

    // The owner has no data of their own, so no insight despite the stranger's session.
    expect(await getHomeInsight(owner.id, NOW)).toBeNull();
  });
});
