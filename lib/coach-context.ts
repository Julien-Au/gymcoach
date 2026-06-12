import type { CoachPayload } from '@/lib/coach';
import { isoWeekStart } from '@/lib/stats';

// ============================================================
// "What your coach sees" summary (issue #154, display-only)
// ============================================================
// Maps the EXACT payload buildCoachPayload assembles for the AI into the
// compact, human-readable summary the coach page card renders. This module
// only reshapes fields the payload already carries - it never re-derives a
// signal from raw rows, so the card cannot drift from what the coach reads.

export interface CoachContextSummary {
  goals: Array<{
    exerciseName: string;
    targetWeight: number;
    targetReps: number;
    progressPct: number;
    achieved: boolean;
  }>;
  stalledExercises: string[];
  deloadActive: boolean;
  deloadRecommended: boolean;
  deloadReasons: string[];
  conditioning: {
    currentMinutes: number;
    currentKm: number;
    currentSessions: number;
    weeklyTargetMin: number;
  };
  // Null when no readiness check-in landed within the payload's 7-day window.
  readiness: {
    daysAgo: number;
    readiness: number;
    sleepQuality: number;
  } | null;
  // Distinct ISO weeks with at least one logged session inside the payload's
  // 8-week progression window - how much history the coach actually sees.
  weeksOfHistory: number;
  // Distinct exercises with recent history in the payload.
  exercisesTracked: number;
}

export function summarizeCoachPayload(payload: CoachPayload): CoachContextSummary {
  const weekStarts = new Set<string>();
  for (const exercise of payload.recentProgress) {
    for (const session of exercise.sessions) {
      weekStarts.add(isoWeekStart(new Date(session.date)).toISOString());
    }
  }

  return {
    goals: payload.goals.map((g) => ({
      exerciseName: g.exerciseName,
      targetWeight: g.targetWeight,
      targetReps: g.targetReps,
      progressPct: g.progressPct,
      achieved: g.achieved,
    })),
    stalledExercises: payload.fatigue.stalledExercises,
    deloadActive: payload.fatigue.deloadActive,
    deloadRecommended: payload.fatigue.deloadRecommended,
    deloadReasons: payload.fatigue.deloadReasons,
    conditioning: {
      currentMinutes: payload.conditioning.weekCurrent.minutes,
      currentKm: payload.conditioning.weekCurrent.km,
      currentSessions: payload.conditioning.weekCurrent.sessions,
      weeklyTargetMin: payload.conditioning.weeklyTargetMin,
    },
    readiness: payload.latestReadiness
      ? {
          daysAgo: payload.latestReadiness.daysAgo,
          readiness: payload.latestReadiness.readiness,
          sleepQuality: payload.latestReadiness.sleepQuality,
        }
      : null,
    weeksOfHistory: weekStarts.size,
    exercisesTracked: payload.recentProgress.length,
  };
}
