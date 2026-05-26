import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getCurrentUserId } from '@/lib/auth';

// ============================================================
// Helpers for the API routes
// ============================================================
// Centralizes the recurring patterns: auth, Zod body parsing,
// turning Prisma errors into JSON responses.

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
    throw new ApiError(400, 'Invalid JSON');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid data');
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
        { error: 'Conflict: an entry with this value already exists.' },
        { status: 409 },
      );
    }
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
  }

  console.error('[api] unhandled error:', err);
  return NextResponse.json({ error: 'Server error.' }, { status: 500 });
}
