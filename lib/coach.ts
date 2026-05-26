import { db } from '@/lib/db';
import {
  applyBodyweight,
  best1RM,
  exerciseProgress,
  isoWeekStart,
  totalVolume,
} from '@/lib/stats';
import { COACH_SYSTEM_PROMPT } from '@/lib/prompts/coach-system-prompt';

// ============================================================
// Payload structuré envoyé au coach
// ============================================================
// Toutes les agrégations sont calculées côté serveur pour éviter de
// surcharger le modèle avec des centaines de lignes de sets bruts.

export interface CoachPayload {
  generatedAt: string;
  // Profil : poids du corps en kg, utilisé pour les exos `usesBodyweight`.
  // Toutes les charges et volumes du payload incluent déjà le bodyweight
  // quand applicable - le coach peut s'y fier directement.
  userBodyweight: number | null;
  weekCurrent: WeekSummary;
  weekPrevious: WeekSummary | null;
  activeProgram: ProgramSummary | null;
  // Pour chaque exercice du programme : la progression sur les 8 dernières
  // semaines (charges max + 1RM par séance, valeurs effectives PdC inclus).
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
// Construction du payload
// ============================================================

export async function buildCoachPayload(userId: string): Promise<CoachPayload> {
  const now = new Date();
  const currentWeekStart = isoWeekStart(now);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
  const eightWeeksAgo = new Date(currentWeekStart);
  eightWeeksAgo.setUTCDate(eightWeeksAgo.getUTCDate() - 7 * 8);

  // On récupère le bodyweight en premier (1 row, négligeable) pour pouvoir le
  // passer à weekSummary qui en dépend pour calculer les volumes effectifs.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { bodyweight: true },
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

  // Charge actuelle par exercice = workingWeight de la dernière séance.
  const currentLoadByExercise = new Map<string, number>();
  const setsByExercise = new Map<string, typeof recentSets>();
  for (const s of recentSets) {
    const arr = setsByExercise.get(s.exerciseId);
    if (arr) arr.push(s);
    else setsByExercise.set(s.exerciseId, [s]);
  }

  const recentProgress: CoachPayload['recentProgress'] = [];
  // On enrichit avec target reps depuis le programme actif (si l'exo est dedans).
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
    userBodyweight: bodyweight,
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
      // Volume total semaine = somme des volumes effectifs par exercice.
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
// Appel OpenRouter (API compatible Chat Completions)
// ============================================================

export class CoachError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CoachError';
  }
}

interface OpenRouterChoice {
  message: { role: string; content: string };
  finish_reason: string | null;
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: { message: string; code?: number | string };
}

export interface CoachCompletion {
  markdown: string;
  modelUsed: string;
  promptText: string; // payload JSON envoyé, pour audit
}

export async function callCoach(payload: CoachPayload): Promise<CoachCompletion> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new CoachError(503, 'OPENROUTER_API_KEY non configurée.');
  }
  const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.5';
  const appName = process.env.OPENROUTER_APP_NAME ?? 'GymCoach';
  const appUrl = process.env.OPENROUTER_APP_URL ?? 'http://localhost:3030';

  const userMessage = JSON.stringify(payload, null, 2);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': appUrl,
    'X-Title': appName,
  };

  const body = {
    model,
    messages: [
      { role: 'system', content: COACH_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.4,
    max_tokens: 32000,
  };

  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new CoachError(
      502,
      `Échec réseau vers OpenRouter : ${err instanceof Error ? err.message : 'inconnu'}`,
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new CoachError(
      res.status,
      `OpenRouter ${res.status} : ${text.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as OpenRouterResponse;
  if (json.error) {
    throw new CoachError(502, `OpenRouter: ${json.error.message}`);
  }
  const markdown = json.choices[0]?.message?.content?.trim();
  if (!markdown) {
    throw new CoachError(502, 'Réponse vide du coach.');
  }

  return {
    markdown,
    modelUsed: json.model ?? model,
    promptText: userMessage,
  };
}
