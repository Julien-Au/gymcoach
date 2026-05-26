import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, requireApiUserId } from '@/lib/api';
import { buildCoachPayload, callCoach, CoachError } from '@/lib/coach';
import { isoWeekStart } from '@/lib/stats';

// POST /api/coach : génère un nouveau debrief pour la semaine en cours.
// Le payload structuré est calculé serveur-side puis envoyé au modèle via
// OpenRouter. La réponse markdown est stockée dans CoachSession.
export async function POST() {
  try {
    const userId = await requireApiUserId();

    const payload = await buildCoachPayload(userId);
    const { markdown, modelUsed, promptText } = await callCoach(payload);

    const now = new Date();
    const weekStart = isoWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const stored = await db.coachSession.create({
      data: {
        userId,
        weekStart,
        weekEnd,
        prompt: promptText,
        response: markdown,
      },
    });

    return NextResponse.json({
      id: stored.id,
      response: markdown,
      modelUsed,
      createdAt: stored.createdAt,
    });
  } catch (err) {
    if (err instanceof CoachError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return handleApiError(err);
  }
}

// GET /api/coach : historique des debriefs (les 20 derniers).
export async function GET() {
  try {
    const userId = await requireApiUserId();
    const items = await db.coachSession.findMany({
      where: { userId },
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
    });
    return NextResponse.json(items);
  } catch (err) {
    return handleApiError(err);
  }
}
