import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

// Profil utilisateur (self-service). Mono-user, donc pas d'admin/role check.

const profileUpdateSchema = z.object({
  // Poids du corps en kg. null = effacer la valeur (revient au comportement
  // pré-bodyweight où le tonnage des exos PdC reste basé sur set.weight seul).
  bodyweight: z
    .number()
    .min(20, 'Trop bas')
    .max(300, 'Trop haut')
    .nullable()
    .optional(),
});

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, bodyweight: true },
    });
    return NextResponse.json(user);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, profileUpdateSchema);
    const updated = await db.user.update({
      where: { id: userId },
      data: {
        ...(data.bodyweight !== undefined ? { bodyweight: data.bodyweight } : {}),
      },
      select: { email: true, bodyweight: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
