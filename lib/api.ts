import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getCurrentUserId } from '@/lib/auth';

// ============================================================
// Helpers pour les API routes
// ============================================================
// Centralise les patterns récurrents : auth, parse body Zod,
// transformation des erreurs Prisma en réponses JSON.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireApiUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }
  return userId;
}

export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, 'JSON invalide');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Données invalides');
  }
  return parsed.data;
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Conflit : une entrée avec cette valeur existe déjà.' },
        { status: 409 },
      );
    }
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
    }
  }

  console.error('[api] unhandled error:', err);
  return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
}
