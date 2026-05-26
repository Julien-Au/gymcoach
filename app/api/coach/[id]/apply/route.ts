import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { applyAdjustmentsSchema } from '@/lib/coach-adjustments';

interface Params {
  params: { id: string };
}

// POST /api/coach/[id]/apply
// Applique les ajustements validés à l'utilisateur sur le programme actif :
// - update les `ProgramExercise` correspondants par nom d'exercice
// - append les notes éventuelles à `ProgramExercise.notes` (préfixées par la
//   date pour traçabilité)
// - marque la `CoachSession` comme appliquée (`appliedAt`).
export async function POST(req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    const { adjustments } = await parseJsonBody(req, applyAdjustmentsSchema);

    const coachSession = await db.coachSession.findUnique({
      where: { id: params.id },
    });
    if (!coachSession || coachSession.userId !== userId) {
      throw new ApiError(404, 'Debrief introuvable.');
    }

    const activeProgram = await db.program.findFirst({
      where: { userId, isActive: true },
      include: {
        workouts: {
          include: {
            exercises: {
              include: { exercise: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!activeProgram) {
      throw new ApiError(400, 'Aucun programme actif pour appliquer les ajustements.');
    }

    // Index des ProgramExercise par nom d'exercice (en cas de doublon, on
    // collecte toutes les occurrences pour appliquer partout dans le programme).
    const byExerciseName = new Map<string, typeof activeProgram.workouts[number]['exercises']>();
    for (const w of activeProgram.workouts) {
      for (const pe of w.exercises) {
        const key = pe.exercise.name;
        const arr = byExerciseName.get(key);
        if (arr) arr.push(pe);
        else byExerciseName.set(key, [pe]);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const applied: Array<{ exerciseName: string; programExerciseIds: string[] }> = [];
    const skipped: Array<{ exerciseName: string; reason: string }> = [];

    for (const adj of adjustments) {
      const matches = byExerciseName.get(adj.exerciseName);
      if (!matches || matches.length === 0) {
        skipped.push({
          exerciseName: adj.exerciseName,
          reason: 'Exercice introuvable dans le programme actif.',
        });
        continue;
      }

      // Construit l'objet de mise à jour à partir des champs présents.
      const data: {
        targetRepsMin?: number;
        targetRepsMax?: number;
        targetSets?: number;
        targetRIR?: number;
        restSec?: number;
        notes?: string;
      } = {};
      if (adj.suggestedRepsMin != null) data.targetRepsMin = adj.suggestedRepsMin;
      if (adj.suggestedRepsMax != null) data.targetRepsMax = adj.suggestedRepsMax;
      if (adj.suggestedSets != null) data.targetSets = adj.suggestedSets;
      if (adj.suggestedRIR != null) data.targetRIR = adj.suggestedRIR;
      if (adj.suggestedRestSec != null) data.restSec = adj.suggestedRestSec;

      // Garde-fou : si min > max après update, on inverse silencieusement (l'IA
      // peut se tromper, on évite une violation de règle métier silencieuse).
      if (
        data.targetRepsMin != null &&
        data.targetRepsMax != null &&
        data.targetRepsMin > data.targetRepsMax
      ) {
        const tmp = data.targetRepsMin;
        data.targetRepsMin = data.targetRepsMax;
        data.targetRepsMax = tmp;
      }

      const ids: string[] = [];
      for (const pe of matches) {
        // Construit le bloc de notes : on ajoute une ligne datée par-dessus
        // les notes existantes, plutôt que d'écraser l'historique.
        const noteLine = buildNoteLine(today, adj.note, adj.summary, adj.suggestedLoad);
        const nextNotes = noteLine
          ? pe.notes
            ? `${noteLine}\n${pe.notes}`
            : noteLine
          : undefined;

        await db.programExercise.update({
          where: { id: pe.id },
          data: {
            ...data,
            ...(nextNotes !== undefined ? { notes: nextNotes } : {}),
          },
        });
        ids.push(pe.id);
      }
      applied.push({ exerciseName: adj.exerciseName, programExerciseIds: ids });
    }

    const updated = await db.coachSession.update({
      where: { id: params.id },
      data: { appliedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      appliedAt: updated.appliedAt,
      applied,
      skipped,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

function buildNoteLine(
  today: string,
  note: string | null | undefined,
  summary: string,
  suggestedLoad: number | null | undefined,
): string | null {
  const parts: string[] = [];
  if (note?.trim()) parts.push(note.trim());
  else parts.push(summary.trim());
  if (suggestedLoad != null) parts.push(`Cible : ${suggestedLoad} kg`);
  if (parts.length === 0) return null;
  return `[Coach ${today}] ${parts.join(' · ')}`;
}
