import { describe, it, expect } from 'vitest';
import { detectPRs, isPR, exerciseRecords } from './records';

// Minimal set factory: only the fields the PR detector reads.
function set(weight: number, reps: number, isWarmup = false) {
  return { weight, reps, isWarmup };
}

describe('detectPRs', () => {
  it('flags a clear new heaviest set as both a weight and e1RM PR', () => {
    const history = [set(100, 5), set(95, 8)];
    // 110 kg is heavier than the 100 kg prior best, and its e1RM beats them all.
    expect(detectPRs(set(110, 5), history)).toEqual(['weight', 'e1rm']);
  });

  it('does not flag a tie with the prior best (strict comparison)', () => {
    const history = [set(100, 5)];
    // Same load and reps -> same weight and same e1RM -> no PR.
    expect(detectPRs(set(100, 5), history)).toEqual([]);
  });

  it('does not flag a set below the prior best', () => {
    const history = [set(100, 5)];
    expect(detectPRs(set(90, 5), history)).toEqual([]);
  });

  it('treats the first working set as a PR when there is no prior history', () => {
    expect(detectPRs(set(80, 5), [])).toEqual(['weight', 'e1rm']);
    // History made only of warm-ups counts as no working baseline.
    expect(detectPRs(set(80, 5), [set(40, 10, true)])).toEqual(['weight', 'e1rm']);
  });

  it('flags an e1RM PR for a higher-rep set that does not beat max weight', () => {
    // Prior best: 100 kg x 5 -> e1RM ~ 116.7. Candidate 95 kg x 10 -> e1RM ~ 126.7.
    // Lighter load (no weight PR) but a clear estimated-1RM PR.
    const history = [set(100, 5)];
    expect(detectPRs(set(95, 10), history)).toEqual(['e1rm']);
  });

  it('flags only a weight PR when the load is a record but the e1RM is not', () => {
    // Prior best e1RM comes from 90 kg x 12 (~126). A heavy low-rep single at
    // 105 kg sets a weight PR but its e1RM (~108.5) does not beat 126.
    const history = [set(90, 12), set(100, 1)];
    expect(detectPRs(set(105, 1), history)).toEqual(['weight']);
  });

  it('never flags a warm-up candidate', () => {
    expect(detectPRs(set(200, 5, true), [set(100, 5)])).toEqual([]);
  });

  it('ignores warm-ups in the history baseline', () => {
    // The only heavy set in history is a warm-up, so a 90 kg working set is a PR.
    const history = [set(150, 3, true), set(80, 5)];
    expect(detectPRs(set(90, 5), history)).toEqual(['weight', 'e1rm']);
  });

  it('isPR mirrors detectPRs as a boolean', () => {
    expect(isPR(set(110, 5), [set(100, 5)])).toBe(true);
    expect(isPR(set(90, 5), [set(100, 5)])).toBe(false);
  });
});

// Cardio sets (issue #133) can never set a lifting PR.
describe('detectPRs - cardio exclusion', () => {
  it('ignores a cardio candidate even with non-zero weight/reps', () => {
    expect(
      detectPRs({ weight: 100, reps: 10, isWarmup: false, durationSec: 750 }, []),
    ).toEqual([]);
  });

  it('ignores a normalized cardio candidate (weight 0, reps 1)', () => {
    expect(
      detectPRs({ weight: 0, reps: 1, isWarmup: false, durationSec: 750 }, []),
    ).toEqual([]);
  });
});

// Records board (issue #190): all-time bests per exercise.
describe('exerciseRecords', () => {
  // Builds a record set; date defaults are spaced so order is unambiguous.
  function rset(
    exerciseName: string,
    weight: number,
    reps: number,
    date: string,
    opts: { isWarmup?: boolean; durationSec?: number | null } = {},
  ) {
    return {
      exerciseName,
      weight,
      reps,
      isWarmup: opts.isWarmup ?? false,
      durationSec: opts.durationSec ?? null,
      sessionStartedAt: new Date(`${date}T10:00:00.000Z`),
    };
  }

  it('returns the heaviest set and the best e1RM with their dates', () => {
    const records = exerciseRecords([
      rset('Squat', 100, 5, '2026-01-01'),
      rset('Squat', 110, 3, '2026-02-01'), // heaviest load
      rset('Squat', 95, 10, '2026-03-01'), // best e1RM (~126.7)
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      exerciseName: 'Squat',
      maxWeight: 110,
      maxWeightReps: 3,
      maxWeightDate: '2026-02-01',
      bestE1RM: +(95 * (1 + 10 / 30)).toFixed(1),
      bestE1RMDate: '2026-03-01',
    });
  });

  it('keeps the earlier date on a tie (strict comparison)', () => {
    const records = exerciseRecords([
      rset('Bench', 80, 5, '2026-01-01'),
      rset('Bench', 80, 5, '2026-02-01'), // identical -> not a new record
    ]);
    expect(records[0]!.maxWeightDate).toBe('2026-01-01');
    expect(records[0]!.bestE1RMDate).toBe('2026-01-01');
  });

  it('excludes warm-up and cardio sets', () => {
    const records = exerciseRecords([
      rset('Deadlift', 200, 1, '2026-01-01', { isWarmup: true }),
      rset('Deadlift', 60, 5, '2026-01-02'), // only working set
      rset('Row', 0, 1, '2026-01-03', { durationSec: 600 }), // cardio
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]!.exerciseName).toBe('Deadlift');
    expect(records[0]!.maxWeight).toBe(60);
  });

  it('uses the bodyweight-effective load passed by the caller', () => {
    // The caller has already added bodyweight (e.g. pull-up at +0 -> 80 kg
    // effective). The record reads that effective load directly.
    const records = exerciseRecords([rset('Pull-up', 80, 8, '2026-01-01')]);
    expect(records[0]!.maxWeight).toBe(80);
    expect(records[0]!.maxWeightReps).toBe(8);
  });

  it('groups multiple exercises and sorts alphabetically', () => {
    const records = exerciseRecords([
      rset('Squat', 140, 3, '2026-01-01'),
      rset('Bench', 100, 5, '2026-01-01'),
      rset('Deadlift', 180, 2, '2026-01-01'),
    ]);
    expect(records.map((r) => r.exerciseName)).toEqual([
      'Bench',
      'Deadlift',
      'Squat',
    ]);
  });

  it('returns an empty board when there is no qualifying set', () => {
    expect(exerciseRecords([])).toEqual([]);
    expect(
      exerciseRecords([rset('Squat', 100, 5, '2026-01-01', { isWarmup: true })]),
    ).toEqual([]);
  });
});
