import { Sparkles } from 'lucide-react';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import {
  CoachClient,
  type ProgramExerciseDefaults,
} from '@/components/coach/coach-client';

export default async function CoachPage() {
  const auth = await requireSession();

  const [history, activeProgram] = await Promise.all([
    db.coachSession.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        response: true,
        appliedAt: true,
        createdAt: true,
      },
    }),
    db.program.findFirst({
      where: { userId: auth.userId, isActive: true },
      include: {
        workouts: {
          include: {
            exercises: {
              include: { exercise: { select: { name: true } } },
            },
          },
        },
      },
    }),
  ]);

  // Map exerciseName → valeurs actuelles du programme (pour pré-remplir les
  // ajustements quand le coach n'émet pas de valeur explicite).
  const programDefaults: Record<string, ProgramExerciseDefaults> = {};
  if (activeProgram) {
    for (const w of activeProgram.workouts) {
      for (const pe of w.exercises) {
        const key = pe.exercise.name;
        if (programDefaults[key]) continue;
        programDefaults[key] = {
          targetRepsMin: pe.targetRepsMin,
          targetRepsMax: pe.targetRepsMax,
          targetSets: pe.targetSets,
          targetRIR: pe.targetRIR,
          restSec: pe.restSec,
        };
      }
    }
  }

  // Pre-sérialise les dates pour le client component.
  const initialHistory = history.map((h) => ({
    id: h.id,
    weekStart: h.weekStart.toISOString(),
    weekEnd: h.weekEnd.toISOString(),
    response: h.response,
    appliedAt: h.appliedAt?.toISOString() ?? null,
    createdAt: h.createdAt.toISOString(),
  }));

  const hasApiKey = !!process.env.OPENROUTER_API_KEY;

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Sparkles className="size-6" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Coach</h1>
            <p className="text-xs text-muted-foreground">
              Debrief hebdomadaire généré par Claude.
            </p>
          </div>
        </div>

        <CoachClient
          initialHistory={initialHistory}
          hasApiKey={hasApiKey}
          programDefaults={programDefaults}
        />
      </div>
    </main>
  );
}
