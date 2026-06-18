import { db } from './db';
import {
  applyBodyweight,
  exerciseProgress,
  isStalled,
  isoWeekStart,
} from './stats';
import { exerciseRecords } from './records';
import {
  recommendDeload,
  deloadReasonLine,
  DELOAD_READINESS_MAX_AGE_DAYS,
  DELOAD_READINESS_LOOKBACK,
  type DeloadRecommendation,
} from './deload';

// How far back to look when judging stalled lifts and all-time records for the
// home insight. Matches the progress page's recent window so the home nudge and
// the progress page agree on what counts as "recent".
const INSIGHT_WINDOW_WEEKS = 12;

export type HomeInsightKind = 'deload' | 'stall' | 'pr' | 'on-track';

export interface HomeInsight {
  kind: HomeInsightKind;
  title: string;
  detail: string;
  // Where the user goes to act on the insight.
  href: string;
}

export interface HomeInsightInput {
  // Program-level deload recommendation (reuses lib/deload).
  deload: DeloadRecommendation;
  // Lifts currently flagged by isStalled, any order.
  stalledExerciseNames: string[];
  // A personal record hit in the user's most recent finished session, if any.
  recentPR: { exerciseName: string; kind: 'weight' | 'e1rm' } | null;
  // Distinct training days in the current ISO week (null when unknown).
  trainingDaysThisWeek: number | null;
}

// Pure selector: given the already-derived deterministic signals, returns the
// single highest-priority insight to greet the user with, or null when there is
// nothing worth surfacing (e.g. a brand-new account with no history). Priority:
// a recommended deload > a stalled lift > a fresh personal record > an
// on-track consistency line. Display-only - no LLM, no side effects.
export function selectHomeInsight(input: HomeInsightInput): HomeInsight | null {
  if (input.deload.recommended && input.deload.reasons.length > 0) {
    return {
      kind: 'deload',
      title: 'Recovery may be due',
      detail: input.deload.reasons.map(deloadReasonLine).join(' '),
      href: '/progress',
    };
  }

  if (input.stalledExerciseNames.length > 0) {
    const names = input.stalledExerciseNames;
    return {
      kind: 'stall',
      title: names.length === 1 ? 'A lift has stalled' : `${names.length} lifts have stalled`,
      detail:
        names.length === 1
          ? `${names[0]} has not progressed recently. A small change in load, reps, or technique can get it moving again.`
          : `${names.join(', ')} have not progressed recently. Check the progress page for what to adjust.`,
      href: '/progress',
    };
  }

  if (input.recentPR) {
    const what =
      input.recentPR.kind === 'weight' ? 'a new heaviest set' : 'a new best estimated 1RM';
    return {
      kind: 'pr',
      title: 'New personal record',
      detail: `Your last session set ${what} on ${input.recentPR.exerciseName}. Nice work.`,
      href: '/progress',
    };
  }

  if (input.trainingDaysThisWeek != null && input.trainingDaysThisWeek > 0) {
    const n = input.trainingDaysThisWeek;
    return {
      kind: 'on-track',
      title: 'You are training consistently',
      detail: `Trained ${n} day${n > 1 ? 's' : ''} this week. Keep the momentum going.`,
      href: '/progress',
    };
  }

  return null;
}

// Server-side: gather the deterministic signals for a user and pick the single
// home insight. Composes the existing derivations (stall detection, deload
// recommendation, records, weekly frequency) over focused queries; it never
// writes and never calls the LLM. Returns null when there is nothing to surface.
export async function getHomeInsight(
  userId: string,
  now: Date = new Date(),
): Promise<HomeInsight | null> {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - INSIGHT_WINDOW_WEEKS * 7);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { bodyweight: true },
  });
  const bodyweight = user?.bodyweight ?? null;

  // Recent non-warmup strength sets, for stall detection. Grouped by exercise
  // in memory (one query) rather than per-exercise queries.
  const recentSets = await db.set.findMany({
    where: {
      isWarmup: false,
      completedAt: { gte: since },
      session: { userId },
      exercise: { category: { not: 'CARDIO' } },
    },
    orderBy: { completedAt: 'asc' },
    select: {
      weight: true,
      reps: true,
      isWarmup: true,
      durationSec: true,
      sessionId: true,
      session: { select: { startedAt: true } },
      exercise: { select: { name: true, usesBodyweight: true } },
    },
  });

  const byExercise = new Map<
    string,
    {
      weight: number;
      reps: number;
      isWarmup: boolean;
      durationSec: number | null;
      sessionId: string;
      sessionStartedAt: Date;
      usesBodyweight: boolean;
    }[]
  >();
  for (const s of recentSets) {
    const list = byExercise.get(s.exercise.name) ?? [];
    list.push({
      weight: s.weight,
      reps: s.reps,
      isWarmup: s.isWarmup,
      durationSec: s.durationSec,
      sessionId: s.sessionId,
      sessionStartedAt: s.session.startedAt,
      usesBodyweight: s.exercise.usesBodyweight,
    });
    byExercise.set(s.exercise.name, list);
  }

  const stalledExerciseNames: string[] = [];
  for (const [name, sets] of byExercise) {
    const points = exerciseProgress(applyBodyweight(sets, bodyweight));
    if (isStalled(points.map((p) => p.estimated1RM))) {
      stalledExerciseNames.push(name);
    }
  }

  // Recent readiness check-ins feed the deload recommendation's low-readiness arm.
  const readinessSince = new Date(now);
  readinessSince.setUTCDate(readinessSince.getUTCDate() - DELOAD_READINESS_MAX_AGE_DAYS);
  const checkins = await db.readinessCheckin.findMany({
    where: { userId, createdAt: { gte: readinessSince } },
    orderBy: { createdAt: 'desc' },
    take: DELOAD_READINESS_LOOKBACK,
    select: { readiness: true },
  });

  const deload = recommendDeload({
    stalledExerciseNames,
    recentReadiness: checkins.map((c) => c.readiness),
  });

  // A fresh personal record: an all-time record (over full history) whose date
  // falls on the user's most recent finished session.
  let recentPR: HomeInsightInput['recentPR'] = null;
  const lastSession = await db.session.findFirst({
    where: { userId, finishedAt: { not: null } },
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  });
  if (lastSession) {
    const lastDay = lastSession.startedAt.toISOString().slice(0, 10);
    const recordSets = await db.set.findMany({
      where: {
        isWarmup: false,
        session: { userId },
        exercise: { category: { not: 'CARDIO' } },
      },
      orderBy: { session: { startedAt: 'asc' } },
      select: {
        weight: true,
        reps: true,
        isWarmup: true,
        durationSec: true,
        exercise: { select: { name: true, usesBodyweight: true } },
        session: { select: { startedAt: true } },
      },
    });
    const records = exerciseRecords(
      recordSets.map((s) => ({
        weight:
          s.exercise.usesBodyweight && bodyweight && bodyweight > 0
            ? +(bodyweight + s.weight).toFixed(2)
            : s.weight,
        reps: s.reps,
        isWarmup: s.isWarmup,
        durationSec: s.durationSec,
        exerciseName: s.exercise.name,
        sessionStartedAt: s.session.startedAt,
      })),
    );
    const weightPR = records.find((r) => r.maxWeightDate === lastDay);
    const e1rmPR = records.find((r) => r.bestE1RMDate === lastDay);
    if (weightPR) recentPR = { exerciseName: weightPR.exerciseName, kind: 'weight' };
    else if (e1rmPR) recentPR = { exerciseName: e1rmPR.exerciseName, kind: 'e1rm' };
  }

  // Distinct training days in the current ISO week.
  const weekStart = isoWeekStart(now);
  const thisWeekSessions = await db.session.findMany({
    where: { userId, finishedAt: { not: null }, startedAt: { gte: weekStart } },
    select: { startedAt: true },
  });
  const days = new Set(thisWeekSessions.map((s) => s.startedAt.toISOString().slice(0, 10)));
  const trainingDaysThisWeek = thisWeekSessions.length > 0 ? days.size : null;

  return selectHomeInsight({ deload, stalledExerciseNames, recentPR, trainingDaysThisWeek });
}
