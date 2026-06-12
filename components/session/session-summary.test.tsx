import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Exercise, ProgramExercise, Session } from '@prisma/client';
import type { PendingSet } from '@/lib/indexeddb';
import { SessionSummary, computeSessionPRs } from './session-summary';

const exo: Exercise = {
  id: 'e1',
  userId: 'u',
  name: 'Squat',
  muscleGroup: 'QUADS',
  category: 'COMPOUND',
  defaultRestSec: 120,
  notes: null,
  usesBodyweight: false,
  createdAt: new Date(),
};

const pe: ProgramExercise & { exercise: Exercise } = {
  id: 'pe',
  workoutId: 'w',
  exerciseId: 'e1',
  order: 1,
  targetSets: 3,
  targetRepsMin: 6,
  targetRepsMax: 10,
  targetRIR: 2,
  restSec: 120,
  tempo: null,
  notes: null,
  supersetGroup: null,
  exercise: exo,
};

function pendingSet(over: Partial<PendingSet>): PendingSet {
  return {
    localId: over.localId ?? 'l1',
    sessionId: 's1',
    exerciseId: 'e1',
    setNumber: over.setNumber ?? 1,
    weight: over.weight ?? 100,
    reps: over.reps ?? 5,
    rir: null,
    notes: null,
    isWarmup: over.isWarmup ?? false,
    isDropSet: false,
    createdAt: 0,
    status: 'synced',
    serverId: 'srv1',
    syncedAt: 0,
    attempts: 0,
    lastError: null,
    ...over,
  };
}

const session = { id: 's1', startedAt: new Date(), notes: null } as unknown as Session;

describe('computeSessionPRs', () => {
  it('flags a weight PR when a working set beats the prior heaviest load', () => {
    const prs = computeSessionPRs(
      [pendingSet({ weight: 110, reps: 5 })],
      [pe],
      { e1: [{ weight: 100, reps: 5 }] },
    );
    expect(prs).toHaveLength(1);
    const [first] = prs;
    expect(first?.exerciseName).toBe('Squat');
    expect(first?.types).toEqual(['weight', 'e1rm']);
  });

  it('flags an e1RM-only PR when more reps at the same load beat the best estimated 1RM', () => {
    // Same load (no weight PR) but more reps -> higher Epley e1RM.
    const prs = computeSessionPRs(
      [pendingSet({ weight: 100, reps: 8 })],
      [pe],
      { e1: [{ weight: 100, reps: 5 }] },
    );
    expect(prs).toHaveLength(1);
    expect(prs[0]?.types).toEqual(['e1rm']);
  });

  it('returns nothing when no set beats the prior session', () => {
    const prs = computeSessionPRs(
      [pendingSet({ weight: 100, reps: 5 })],
      [pe],
      { e1: [{ weight: 100, reps: 5 }] },
    );
    expect(prs).toHaveLength(0);
  });

  it('ignores warmup sets and never compares a set against itself', () => {
    // First working set sets the bar; the second (lighter) one must not PR.
    const prs = computeSessionPRs(
      [
        pendingSet({ localId: 'w', weight: 120, reps: 5, isWarmup: true }),
        pendingSet({ localId: 'a', setNumber: 1, weight: 110, reps: 5 }),
        pendingSet({ localId: 'b', setNumber: 2, weight: 105, reps: 5 }),
      ],
      [pe],
      { e1: [{ weight: 100, reps: 5 }] },
    );
    expect(prs).toHaveLength(1);
    // Only the heaviest-load type from the first set; the warmup at 120 is ignored.
    expect(prs[0]?.types).toContain('weight');
    expect(prs[0]?.bestWeight).toBe(110);
  });
});

describe('SessionSummary PR section', () => {
  it('renders the PR section when a record was set this session', () => {
    render(
      <SessionSummary
        session={session}
        sets={[pendingSet({ weight: 110, reps: 5 })]}
        programExercises={[pe]}
        unit="KG"
        priorSets={{ e1: [{ weight: 100, reps: 5 }] }}
        onBack={() => {}}
        onFinish={() => {}}
        finishing={false}
      />,
    );
    expect(screen.getByText('Personal records this session')).toBeTruthy();
    expect(screen.getByText('heaviest load')).toBeTruthy();
  });

  it('omits the PR section entirely when no record was set', () => {
    render(
      <SessionSummary
        session={session}
        sets={[pendingSet({ weight: 100, reps: 5 })]}
        programExercises={[pe]}
        unit="KG"
        priorSets={{ e1: [{ weight: 100, reps: 5 }] }}
        onBack={() => {}}
        onFinish={() => {}}
        finishing={false}
      />,
    );
    expect(screen.queryByText('Personal records this session')).toBeNull();
  });
});
