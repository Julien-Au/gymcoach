import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programExerciseInputSchema } from '@/lib/schemas/program-exercise';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

// Ownership is enforced by scoping the writes themselves through the owning
// program (issue #317): a stranger's id makes Prisma throw P2025, which
// handleApiError maps to 404. No separate check to delete.

export async function PUT(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    // Scoped existence probe so a stranger gets 404 before any 400 about the
    // body; the update below carries the same scope, so this probe is about
    // the status code, not the security boundary.
    const owned = await db.programExercise.findFirst({
      where: { id: params.id, workout: { program: { userId } } },
      select: { id: true },
    });
    if (!owned) throw new ApiError(404, 'Program exercise not found.');

    const data = await parseJsonBody(req, programExerciseInputSchema);

    const exercise = await db.exercise.findFirst({
      where: { id: data.exerciseId, userId },
    });
    if (!exercise) {
      throw new ApiError(400, 'Invalid exercise.');
    }

    const updated = await db.programExercise.update({
      where: { id: params.id, workout: { program: { userId } } },
      data: {
        exerciseId: data.exerciseId,
        targetSets: data.targetSets,
        targetRepsMin: data.targetRepsMin,
        targetRepsMax: data.targetRepsMax,
        targetRIR: data.targetRIR,
        restSec: data.restSec,
        autoregulationMode: data.autoregulationMode ?? undefined,
        fatigueRate: data.fatigueRate,
        loadAdjustmentPct: data.loadAdjustmentPct,
        tempo: data.tempo ?? null,
        notes: data.notes ?? null,
        // Superset pairing (issue #146): absent = leave unchanged (Prisma
        // skips undefined), null = unpair, number = (re)pair.
        supersetGroup: data.supersetGroup,
      },
      include: { exercise: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    await db.programExercise.delete({
      where: { id: params.id, workout: { program: { userId } } },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
