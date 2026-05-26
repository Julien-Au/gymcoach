import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { applyAdjustmentsSchema } from '@/lib/coach-adjustments';

interface Params {
  params: { id: string };
}

// POST /api/coach/[id]/apply
// Applies the adjustments validated by the user to the active program:
// - updates the matching `ProgramExercise` records by exercise name
// - appends any notes to `ProgramExercise.notes` (prefixed with the date for
//   traceability)
// - marks the `CoachSession` as applied (`appliedAt`).
export async function POST(req: Request, { params }: Params) {
  try {
    const userId = await requireApiUserId();
    const { adjustments } = await parseJsonBody(req, applyAdjustmentsSchema);

    const coachSession = await db.coachSession.findUnique({
      where: { id: params.id },
    });
    if (!coachSession || coachSession.userId !== userId) {
      throw new ApiError(404, 'Debrief not found.');
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
      throw new ApiError(400, 'No active program to apply the adjustments to.');
    }

    // Index of ProgramExercise by exercise name (in case of duplicates, we
    // collect every occurrence to apply everywhere in the program).
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
          reason: 'Exercise not found in the active program.',
        });
        continue;
      }

      // Build the update object from the fields that are present.
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

      // Safeguard: if min > max after the update, we swap them silently (the AI
      // can be wrong, we avoid a silent business-rule violation).
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
        // Build the notes block: we add a dated line on top of the existing
        // notes, rather than overwriting the history.
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
  if (suggestedLoad != null) parts.push(`Target: ${suggestedLoad} kg`);
  if (parts.length === 0) return null;
  return `[Coach ${today}] ${parts.join(' · ')}`;
}
