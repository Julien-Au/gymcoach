import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionStartSchema } from '@/lib/schemas/session';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const sessions = await db.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: {
        workout: { select: { name: true } },
        program: { select: { name: true } },
        _count: { select: { sets: true } },
      },
      take: 50,
    });
    return NextResponse.json(sessions);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/sessions : démarre une nouvelle session sur un workout du user.
// Échoue si une session non clôturée existe déjà sur le même workout
// (évite les sessions zombies créées par double-clic).
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const { workoutId } = await parseJsonBody(req, sessionStartSchema);

    const workout = await db.workout.findUnique({
      where: { id: workoutId },
      include: { program: { select: { userId: true, id: true } } },
    });
    if (!workout || workout.program.userId !== userId) {
      throw new ApiError(404, 'Séance introuvable.');
    }

    const inProgress = await db.session.findFirst({
      where: { userId, workoutId, finishedAt: null },
    });
    if (inProgress) {
      // On retourne la session existante au lieu d'en créer une nouvelle :
      // permet de reprendre proprement après un reload.
      return NextResponse.json(inProgress, { status: 200 });
    }

    const created = await db.session.create({
      data: {
        userId,
        workoutId,
        programId: workout.program.id,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
