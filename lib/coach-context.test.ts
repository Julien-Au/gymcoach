import { describe, it, expect } from 'vitest';
import type { CoachPayload } from '@/lib/coach';
import { summarizeCoachPayload } from './coach-context';

// summarizeCoachPayload only reshapes the payload buildCoachPayload already
// assembled - these tests pin that mapping (and the only derived number, the
// distinct-ISO-week count) for a full payload and for a fresh user.

function emptyPayload(): CoachPayload {
  return {
    generatedAt: '2026-06-12T10:00:00.000Z',
    userProfile: {
      displayName: null,
      sex: null,
      heightCm: null,
      bodyweight: null,
      goal: null,
      weeklyFrequency: null,
    },
    weekCurrent: { weekStart: '2026-06-08T00:00:00.000Z', sessions: [] },
    weekPrevious: null,
    activeProgram: null,
    latestReadiness: null,
    goals: [],
    fatigue: {
      stalledExercises: [],
      deloadRecommended: false,
      deloadReasons: [],
      deloadActive: false,
    },
    conditioning: {
      weekCurrent: { minutes: 0, km: 0, sessions: 0 },
      weekPrevious: null,
      weeklyTargetMin: 150,
    },
    recentProgress: [],
  };
}

describe('summarizeCoachPayload', () => {
  it('maps a fresh user to safe empty states', () => {
    const summary = summarizeCoachPayload(emptyPayload());
    expect(summary.goals).toEqual([]);
    expect(summary.stalledExercises).toEqual([]);
    expect(summary.deloadActive).toBe(false);
    expect(summary.deloadRecommended).toBe(false);
    expect(summary.readiness).toBeNull();
    expect(summary.weeksOfHistory).toBe(0);
    expect(summary.exercisesTracked).toBe(0);
    expect(summary.conditioning).toEqual({
      currentMinutes: 0,
      currentKm: 0,
      currentSessions: 0,
      weeklyTargetMin: 150,
    });
  });

  it('maps a full payload section by section', () => {
    const payload = emptyPayload();
    payload.goals = [
      {
        exerciseName: 'Bench Press',
        targetWeight: 100,
        targetReps: 5,
        progressPct: 82,
        achieved: false,
      },
    ];
    payload.fatigue = {
      stalledExercises: ['Squat'],
      deloadRecommended: true,
      deloadReasons: ['2 lifts stalled'],
      deloadActive: false,
    };
    payload.conditioning = {
      weekCurrent: { minutes: 75, km: 12.5, sessions: 2 },
      weekPrevious: { minutes: 60, km: 10, sessions: 2 },
      weeklyTargetMin: 150,
    };
    payload.latestReadiness = {
      date: '2026-06-10T08:00:00.000Z',
      daysAgo: 2,
      readiness: 4,
      sleepQuality: 3,
      soreness: null,
      note: null,
    };
    payload.recentProgress = [
      {
        exerciseId: 'e1',
        exerciseName: 'Squat',
        muscleGroup: 'legs',
        usesBodyweight: false,
        targetRepsMin: 5,
        targetRepsMax: 8,
        currentLoad: 120,
        sessions: [
          // Two sessions in the same ISO week + one the week after.
          { date: '2026-06-01T10:00:00.000Z', maxWeight: 120, topSetReps: 5, estimated1RM: 140 },
          { date: '2026-06-03T10:00:00.000Z', maxWeight: 120, topSetReps: 6, estimated1RM: 142 },
          { date: '2026-06-09T10:00:00.000Z', maxWeight: 122.5, topSetReps: 5, estimated1RM: 143 },
        ],
      },
      {
        exerciseId: 'e2',
        exerciseName: 'Bench Press',
        muscleGroup: 'chest',
        usesBodyweight: false,
        targetRepsMin: 5,
        targetRepsMax: 8,
        currentLoad: 80,
        sessions: [
          { date: '2026-06-02T10:00:00.000Z', maxWeight: 80, topSetReps: 5, estimated1RM: 93 },
        ],
      },
    ];

    const summary = summarizeCoachPayload(payload);
    expect(summary.goals).toEqual([
      {
        exerciseName: 'Bench Press',
        targetWeight: 100,
        targetReps: 5,
        progressPct: 82,
        achieved: false,
      },
    ]);
    expect(summary.stalledExercises).toEqual(['Squat']);
    expect(summary.deloadRecommended).toBe(true);
    expect(summary.deloadReasons).toEqual(['2 lifts stalled']);
    expect(summary.conditioning).toEqual({
      currentMinutes: 75,
      currentKm: 12.5,
      currentSessions: 2,
      weeklyTargetMin: 150,
    });
    expect(summary.readiness).toEqual({ daysAgo: 2, readiness: 4, sleepQuality: 3 });
    // 2026-06-01/02/03 share an ISO week; 2026-06-09 starts the next one.
    expect(summary.weeksOfHistory).toBe(2);
    expect(summary.exercisesTracked).toBe(2);
  });
});
