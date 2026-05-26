import { db } from '@/lib/db';
import {
  applyBodyweight,
  best1RM,
  exerciseProgress,
  isoWeekStart,
  totalVolume,
} from '@/lib/stats';
import { COACH_SYSTEM_PROMPT } from '@/lib/prompts/coach-system-prompt';
import { getLlmProvider } from '@/lib/llm';

// ============================================================
// Structured payload sent to the coach
// ============================================================
// All aggregations are computed server-side to avoid overloading the
// model with hundreds of rows of raw sets.

export interface CoachPayload {
  generatedAt: string;
  // User profile (when filled in), so the coach can tailor its advice. All
  // loads and volumes in the payload already include the bodyweight when
  // applicable - the coach can rely on them directly.
  userProfile: {
    displayName: string | null;
    sex: string | null;
    heightCm: number | null;
    bodyweight: number | null;
    goal: string | null;
    weeklyFrequency: number | null;
  };
  weekCurrent: WeekSummary;
  weekPrevious: WeekSummary | null;
  activeProgram: ProgramSummary | null;
  // For each program exercise: the progression over the last 8 weeks
  // (max loads + 1RM per session, effective values with bodyweight included).
  recentProgress: Array<{
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    usesBodyweight: boolean;
    targetRepsMin: number;
    targetRepsMax: number;
    currentLoad: number | null;
    sessions: Array<{
      date: string;
      maxWeight: number;
      topSetReps: number;
      estimated1RM: number;
    }>;
  }>;
}

interface WeekSummary {
  weekStart: string;
  sessions: Array<{
    sessionId: string;
    workoutName: string | null;
    startedAt: string;
    finishedAt: string | null;
    durationMin: number | null;
    notes: string | null;
    totalVolume: number;
    workingSetCount: number;
    exercises: Array<{
      exerciseName: string;
      muscleGroup: string;
      sets: Array<{
        setNumber: number;
        weight: number;
        reps: number;
        rir: number | null;
        isWarmup: boolean;
        isDropSet: boolean;
        notes: string | null;
      }>;
      bestE1RM: number;
      volume: number;
    }>;
  }>;
}

interface ProgramSummary {
  id: string;
  name: string;
  phase: string;
  workouts: Array<{
    name: string;
    exercises: Array<{
      exerciseName: string;
      targetSets: number;
      targetRepsMin: number;
      targetRepsMax: number;
      targetRIR: number;
    }>;
  }>;
}

// ============================================================
// Building the payload
// ============================================================

export async function buildCoachPayload(userId: string): Promise<CoachPayload> {
  const now = new Date();
  const currentWeekStart = isoWeekStart(now);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
  const eightWeeksAgo = new Date(currentWeekStart);
  eightWeeksAgo.setUTCDate(eightWeeksAgo.getUTCDate() - 7 * 8);

  // We fetch the bodyweight first (1 row, negligible) so we can pass it to
  // weekSummary, which depends on it to compute the effective volumes.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      sex: true,
      heightCm: true,
      bodyweight: true,
      goal: true,
      weeklyFrequency: true,
    },
  });
  const bodyweight = user?.bodyweight ?? null;

  const [currentWeek, previousWeek, activeProgram, recentSets] = await Promise.all([
    weekSummary(userId, currentWeekStart, addDays(currentWeekStart, 7), bodyweight),
    weekSummary(userId, previousWeekStart, currentWeekStart, bodyweight),
    fetchActiveProgram(userId),
    db.set.findMany({
      where: {
        isWarmup: false,
        completedAt: { gte: eightWeeksAgo },
        session: { userId },
      },
      orderBy: { completedAt: 'asc' },
      select: {
        weight: true,
        reps: true,
        isWarmup: true,
        sessionId: true,
        exerciseId: true,
        exercise: {
          select: {
            id: true,
            name: true,
            muscleGroup: true,
            usesBodyweight: true,
          },
        },
        session: { select: { startedAt: true } },
      },
    }),
  ]);

  // Current load per exercise = workingWeight of the last session.
  const currentLoadByExercise = new Map<string, number>();
  const setsByExercise = new Map<string, typeof recentSets>();
  for (const s of recentSets) {
    const arr = setsByExercise.get(s.exerciseId);
    if (arr) arr.push(s);
    else setsByExercise.set(s.exerciseId, [s]);
  }

  const recentProgress: CoachPayload['recentProgress'] = [];
  // We enrich with target reps from the active program (if the exercise is in it).
  const programTargets = new Map<string, { min: number; max: number }>();
  if (activeProgram) {
    for (const w of activeProgram.workouts) {
      for (const e of w.exercises) {
        programTargets.set(e.exerciseName, { min: e.targetRepsMin, max: e.targetRepsMax });
      }
    }
  }

  for (const [exerciseId, sets] of setsByExercise) {
    if (sets.length === 0) continue;
    const firstSet = sets[0];
    if (!firstSet) continue;
    const exo = firstSet.exercise;
    const points = exerciseProgress(
      applyBodyweight(
        sets.map((s) => ({
          weight: s.weight,
          reps: s.reps,
          isWarmup: s.isWarmup,
          sessionId: s.sessionId,
          sessionStartedAt: s.session.startedAt,
          usesBodyweight: exo.usesBodyweight,
        })),
        bodyweight,
      ),
    );
    const lastPoint = points[points.length - 1];
    const currentLoad = lastPoint ? lastPoint.maxWeight : null;
    if (currentLoad != null) currentLoadByExercise.set(exerciseId, currentLoad);
    const target = programTargets.get(exo.name);
    recentProgress.push({
      exerciseId,
      exerciseName: exo.name,
      muscleGroup: exo.muscleGroup,
      usesBodyweight: exo.usesBodyweight,
      targetRepsMin: target?.min ?? 0,
      targetRepsMax: target?.max ?? 0,
      currentLoad,
      sessions: points.map((p) => ({
        date: p.date,
        maxWeight: p.maxWeight,
        topSetReps: p.topSetReps,
        estimated1RM: p.estimated1RM,
      })),
    });
  }

  return {
    generatedAt: now.toISOString(),
    userProfile: {
      displayName: user?.displayName ?? null,
      sex: user?.sex ?? null,
      heightCm: user?.heightCm ?? null,
      bodyweight,
      goal: user?.goal ?? null,
      weeklyFrequency: user?.weeklyFrequency ?? null,
    },
    weekCurrent: currentWeek,
    weekPrevious: previousWeek.sessions.length === 0 ? null : previousWeek,
    activeProgram,
    recentProgress: recentProgress.sort((a, b) =>
      a.exerciseName.localeCompare(b.exerciseName),
    ),
  };
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

async function weekSummary(
  userId: string,
  weekStart: Date,
  weekEndExclusive: Date,
  bodyweight: number | null,
): Promise<WeekSummary> {
  const sessions = await db.session.findMany({
    where: {
      userId,
      startedAt: { gte: weekStart, lt: weekEndExclusive },
    },
    orderBy: { startedAt: 'asc' },
    include: {
      workout: { select: { name: true } },
      sets: {
        orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }],
        include: {
          exercise: {
            select: { name: true, muscleGroup: true, usesBodyweight: true },
          },
        },
      },
    },
  });

  return {
    weekStart: weekStart.toISOString(),
    sessions: sessions.map((s) => {
      const setsByExo = new Map<
        string,
        {
          exerciseName: string;
          muscleGroup: string;
          usesBodyweight: boolean;
          sets: WeekSummary['sessions'][number]['exercises'][number]['sets'];
        }
      >();
      for (const set of s.sets) {
        const key = set.exerciseId;
        let entry = setsByExo.get(key);
        if (!entry) {
          entry = {
            exerciseName: set.exercise.name,
            muscleGroup: set.exercise.muscleGroup,
            usesBodyweight: set.exercise.usesBodyweight,
            sets: [],
          };
          setsByExo.set(key, entry);
        }
        entry.sets.push({
          setNumber: set.setNumber,
          weight: set.weight,
          reps: set.reps,
          rir: set.rir,
          isWarmup: set.isWarmup,
          isDropSet: set.isDropSet,
          notes: set.notes,
        });
      }
      const exercises = [...setsByExo.values()].map((e) => {
        const eff = applyBodyweight(
          e.sets.map((set) => ({ ...set, usesBodyweight: e.usesBodyweight })),
          bodyweight,
        );
        return {
          exerciseName: e.exerciseName,
          muscleGroup: e.muscleGroup,
          sets: e.sets,
          bestE1RM: +best1RM(eff).toFixed(1),
          volume: totalVolume(eff),
        };
      });
      // Weekly total volume = sum of the effective volumes per exercise.
      const sessionTotalVolume = exercises.reduce((acc, e) => acc + e.volume, 0);
      const durationMin =
        s.finishedAt && s.startedAt
          ? Math.round((s.finishedAt.getTime() - s.startedAt.getTime()) / 60000)
          : null;
      return {
        sessionId: s.id,
        workoutName: s.workout?.name ?? null,
        startedAt: s.startedAt.toISOString(),
        finishedAt: s.finishedAt?.toISOString() ?? null,
        durationMin,
        notes: s.notes,
        totalVolume: sessionTotalVolume,
        workingSetCount: s.sets.filter((set) => !set.isWarmup).length,
        exercises,
      };
    }),
  };
}

async function fetchActiveProgram(userId: string): Promise<ProgramSummary | null> {
  const program = await db.program.findFirst({
    where: { userId, isActive: true },
    include: {
      workouts: {
        orderBy: { order: 'asc' },
        include: {
          exercises: {
            orderBy: { order: 'asc' },
            include: { exercise: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!program) return null;
  return {
    id: program.id,
    name: program.name,
    phase: program.phase,
    workouts: program.workouts.map((w) => ({
      name: w.name,
      exercises: w.exercises.map((pe) => ({
        exerciseName: pe.exercise.name,
        targetSets: pe.targetSets,
        targetRepsMin: pe.targetRepsMin,
        targetRepsMax: pe.targetRepsMax,
        targetRIR: pe.targetRIR,
      })),
    })),
  };
}

// ============================================================
// Coach call (routed through the configured LLM provider)
// ============================================================

export interface CoachCompletion {
  markdown: string;
  modelUsed: string;
  promptText: string; // JSON payload sent, for auditing
}

// Builds the prompt and delegates to the active LLM provider (Anthropic SDK or
// OpenRouter, selected via LLM_PROVIDER). Provider errors surface as LlmError,
// which the API route maps to an HTTP status.
export async function callCoach(payload: CoachPayload): Promise<CoachCompletion> {
  const provider = getLlmProvider();
  const userMessage = JSON.stringify(payload, null, 2);

  const { text, modelUsed } = await provider.complete({
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    temperature: 0.4,
    maxTokens: 8000,
  });

  return { markdown: text, modelUsed, promptText: userMessage };
}
