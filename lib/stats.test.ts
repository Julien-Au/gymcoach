import { describe, expect, it } from 'vitest';
import {
  applyBodyweight,
  best1RM,
  effectiveWeight,
  estimate1RM,
  exerciseProgress,
  isoWeekKey,
  isoWeekStart,
  setVolume,
  totalVolume,
  trainingConsistency,
  weeklyVolumeByMuscleGroup,
} from './stats';

describe('setVolume / totalVolume', () => {
  it('returns weight × reps for a working set', () => {
    expect(setVolume({ weight: 80, reps: 10, isWarmup: false })).toBe(800);
  });
  it('returns 0 for warmup', () => {
    expect(setVolume({ weight: 80, reps: 10, isWarmup: true })).toBe(0);
  });
  it('sums working sets only', () => {
    expect(
      totalVolume([
        { weight: 80, reps: 10, isWarmup: false },
        { weight: 80, reps: 8, isWarmup: false },
        { weight: 40, reps: 10, isWarmup: true },
      ]),
    ).toBe(80 * 10 + 80 * 8);
  });
});

describe('estimate1RM (Epley)', () => {
  it('matches the formula weight * (1 + reps/30)', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(116.667, 2);
    expect(estimate1RM(80, 10)).toBeCloseTo(106.667, 2);
  });
  it('returns 0 for bodyweight', () => {
    expect(estimate1RM(0, 12)).toBe(0);
  });
  it('returns 0 for zero reps', () => {
    expect(estimate1RM(80, 0)).toBe(0);
  });
});

describe('best1RM', () => {
  it('picks the set with the highest estimated 1RM', () => {
    const sets = [
      { weight: 80, reps: 10, isWarmup: false }, // 106.67
      { weight: 100, reps: 5, isWarmup: false }, // 116.67 (best)
      { weight: 60, reps: 12, isWarmup: false }, // 84
      { weight: 120, reps: 1, isWarmup: true }, // ignored
    ];
    expect(best1RM(sets)).toBeCloseTo(116.667, 2);
  });
  it('returns 0 when no working set exists', () => {
    expect(best1RM([{ weight: 80, reps: 10, isWarmup: true }])).toBe(0);
  });
});

describe('isoWeekKey / isoWeekStart', () => {
  it('returns the ISO week key for a Wednesday', () => {
    // 2026-04-29 is a Wednesday in week 18 of 2026
    expect(isoWeekKey(new Date('2026-04-29T12:00:00Z'))).toBe('2026-W18');
  });
  it('returns the ISO week start (monday)', () => {
    const start = isoWeekStart(new Date('2026-04-29T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-04-27T00:00:00.000Z');
  });
  it('handles year boundaries (early January belongs to previous year week)', () => {
    // 2027-01-01 is a Friday → ISO week 53 of 2026
    expect(isoWeekKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53');
  });
});

describe('exerciseProgress', () => {
  it('produces one point per session sorted by date', () => {
    const sets = [
      {
        weight: 80,
        reps: 10,
        isWarmup: false,
        sessionId: 's1',
        sessionStartedAt: new Date('2026-04-20T10:00:00Z'),
      },
      {
        weight: 80,
        reps: 9,
        isWarmup: false,
        sessionId: 's1',
        sessionStartedAt: new Date('2026-04-20T10:00:00Z'),
      },
      {
        weight: 82.5,
        reps: 8,
        isWarmup: false,
        sessionId: 's2',
        sessionStartedAt: new Date('2026-04-27T10:00:00Z'),
      },
      // warmup ignored
      {
        weight: 40,
        reps: 5,
        isWarmup: true,
        sessionId: 's2',
        sessionStartedAt: new Date('2026-04-27T10:00:00Z'),
      },
    ];
    const points = exerciseProgress(sets);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({
      date: '2026-04-20',
      maxWeight: 80,
      topSetReps: 10,
      totalVolume: 80 * 10 + 80 * 9,
    });
    expect(points[1]).toMatchObject({
      date: '2026-04-27',
      maxWeight: 82.5,
      topSetReps: 8,
    });
  });
});

describe('weeklyVolumeByMuscleGroup', () => {
  it('aggregates by ISO week and muscle group', () => {
    const sets = [
      // week 18 (Monday 2026-04-27)
      {
        weight: 80,
        reps: 10,
        isWarmup: false,
        muscleGroup: 'CHEST',
        sessionStartedAt: new Date('2026-04-27T10:00:00Z'),
      },
      {
        weight: 60,
        reps: 12,
        isWarmup: false,
        muscleGroup: 'CHEST',
        sessionStartedAt: new Date('2026-04-29T10:00:00Z'),
      },
      {
        weight: 100,
        reps: 8,
        isWarmup: false,
        muscleGroup: 'BACK_WIDTH',
        sessionStartedAt: new Date('2026-04-29T10:00:00Z'),
      },
      // week 19 (Monday 2026-05-04)
      {
        weight: 82.5,
        reps: 10,
        isWarmup: false,
        muscleGroup: 'CHEST',
        sessionStartedAt: new Date('2026-05-04T10:00:00Z'),
      },
      // warmup ignored
      {
        weight: 40,
        reps: 8,
        isWarmup: true,
        muscleGroup: 'CHEST',
        sessionStartedAt: new Date('2026-05-04T10:00:00Z'),
      },
    ];
    const points = weeklyVolumeByMuscleGroup(sets);
    expect(points).toHaveLength(2);
    const w18 = points[0]!;
    const w19 = points[1]!;
    expect(w18.weekKey).toBe('2026-W18');
    expect(w18.byMuscleGroup.CHEST).toBe(80 * 10 + 60 * 12);
    expect(w18.byMuscleGroup.BACK_WIDTH).toBe(100 * 8);
    expect(w18.total).toBe(80 * 10 + 60 * 12 + 100 * 8);
    expect(w19.weekKey).toBe('2026-W19');
    expect(w19.byMuscleGroup.CHEST).toBe(82.5 * 10);
  });
});

describe('effectiveWeight', () => {
  it('returns setWeight as-is for non-bodyweight exercises', () => {
    expect(effectiveWeight(80, false, 70)).toBe(80);
  });
  it('adds the bodyweight for bodyweight exercises', () => {
    expect(effectiveWeight(0, true, 70)).toBe(70);
    expect(effectiveWeight(10, true, 70)).toBe(80); // weighted pull-ups +10 kg
  });
  it('handles negative loads (assisted machines)', () => {
    expect(effectiveWeight(-15, true, 70)).toBe(55);
  });
  it('falls back to setWeight when bodyweight is missing or zero', () => {
    expect(effectiveWeight(0, true, null)).toBe(0);
    expect(effectiveWeight(0, true, undefined)).toBe(0);
    expect(effectiveWeight(0, true, 0)).toBe(0);
  });
});

describe('applyBodyweight', () => {
  it('only enriches sets flagged usesBodyweight', () => {
    const sets = [
      { weight: 80, reps: 10, isWarmup: false, usesBodyweight: false }, // squat
      { weight: 0, reps: 10, isWarmup: false, usesBodyweight: true }, // bodyweight pull-ups
      { weight: 5, reps: 8, isWarmup: false, usesBodyweight: true }, // pull-ups +5 kg
    ];
    const out = applyBodyweight(sets, 70);
    expect(out[0]?.weight).toBe(80); // unchanged
    expect(out[1]?.weight).toBe(70);
    expect(out[2]?.weight).toBe(75);
  });
  it('returns the original list when bodyweight is missing', () => {
    const sets = [{ weight: 0, reps: 10, isWarmup: false, usesBodyweight: true }];
    expect(applyBodyweight(sets, null)).toEqual(sets);
    expect(applyBodyweight(sets, 0)).toEqual(sets);
  });
  it('lets totalVolume compute the right effective tonnage', () => {
    const sets = [
      { weight: 0, reps: 10, isWarmup: false, usesBodyweight: true }, // 70 × 10
      { weight: 0, reps: 8, isWarmup: false, usesBodyweight: true }, // 70 × 8
    ];
    expect(totalVolume(applyBodyweight(sets, 70))).toBe(70 * 10 + 70 * 8);
  });
});

describe('trainingConsistency', () => {
  // Fixed reference point: Wednesday 2026-06-10, 12:00 UTC.
  const now = new Date('2026-06-10T12:00:00Z');
  // Monday 00:00 UTC of the ISO week containing `now`.
  const currentMonday = isoWeekStart(now);

  // A date inside the ISO week that is `weeksAgo` weeks before the current week,
  // offset by `dayOffset` days from that week's Monday.
  function dayInWeek(weeksAgo: number, dayOffset = 0): Date {
    const d = new Date(currentMonday);
    d.setUTCDate(d.getUTCDate() - weeksAgo * 7 + dayOffset);
    d.setUTCHours(10, 0, 0, 0);
    return d;
  }

  it('returns a zero streak and no crash for empty history', () => {
    const out = trainingConsistency([], { now, windowWeeks: 12 });
    expect(out.currentStreak).toBe(0);
    expect(out.weeks).toHaveLength(12);
    expect(out.weeks.every((w) => w.trainedDays === 0)).toBe(true);
    expect(out.weeks[out.weeks.length - 1]?.isCurrent).toBe(true);
  });

  it('counts an unbroken run of weeks (one session per week)', () => {
    const dates = [
      dayInWeek(0), // current week
      dayInWeek(1),
      dayInWeek(2),
      dayInWeek(3),
    ];
    const out = trainingConsistency(dates, { now, windowWeeks: 12 });
    expect(out.currentStreak).toBe(4);
  });

  it('breaks the streak on a missed week', () => {
    const dates = [
      dayInWeek(0),
      dayInWeek(1),
      // week 2 missed
      dayInWeek(3),
    ];
    const out = trainingConsistency(dates, { now, windowWeeks: 12 });
    expect(out.currentStreak).toBe(2);
  });

  it('de-duplicates multiple sessions on the same calendar day', () => {
    const sameDay = dayInWeek(0, 1);
    const sameDayLater = new Date(sameDay);
    sameDayLater.setUTCHours(18, 0, 0, 0);
    const out = trainingConsistency([sameDay, sameDayLater], { now, windowWeeks: 12 });
    const current = out.weeks[out.weeks.length - 1];
    expect(current?.trainedDays).toBe(1);
  });

  it('does not break the streak when the current week is still empty', () => {
    // No session this week, but a solid run in the prior two weeks.
    const dates = [dayInWeek(1), dayInWeek(2)];
    const out = trainingConsistency(dates, { now, windowWeeks: 12 });
    expect(out.weeks[out.weeks.length - 1]?.trainedDays).toBe(0);
    expect(out.currentStreak).toBe(2);
  });

  it('respects the weeklyFrequency target when present', () => {
    // Two trained days in the current and previous week, one in the week before.
    const dates = [
      dayInWeek(0, 0),
      dayInWeek(0, 2),
      dayInWeek(1, 0),
      dayInWeek(1, 3),
      dayInWeek(2, 0), // only one day this week -> below target of 2
    ];
    const out = trainingConsistency(dates, {
      now,
      windowWeeks: 12,
      weeklyFrequency: 2,
    });
    expect(out.weeklyFrequency).toBe(2);
    // current + previous meet the target; the one-day week does not.
    expect(out.currentStreak).toBe(2);
  });

  it('ignores a target of zero or negative and falls back to >=1 day', () => {
    const out = trainingConsistency([dayInWeek(0), dayInWeek(1)], {
      now,
      windowWeeks: 12,
      weeklyFrequency: 0,
    });
    expect(out.weeklyFrequency).toBeNull();
    expect(out.currentStreak).toBe(2);
  });

  it('clamps the window to the requested number of weeks', () => {
    const out = trainingConsistency([], { now, windowWeeks: 4 });
    expect(out.weeks).toHaveLength(4);
  });
});
