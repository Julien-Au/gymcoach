import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programInputSchema } from '@/lib/schemas/program';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

// Ownership is enforced by scoping every query with userId (issue #317):
// there is no separate check to delete, so a stranger's id yields 404 via a
// null read or Prisma P2025, which handleApiError maps to 404.

export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const program = await db.program.findFirst({
      where: { id: params.id, userId },
      include: {
        workouts: {
          orderBy: { order: 'asc' },
          include: {
            exercises: {
              orderBy: { order: 'asc' },
              include: { exercise: true },
            },
          },
        },
      },
    });
    if (!program) throw new ApiError(404, 'Program not found.');
    return NextResponse.json(program);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, programInputSchema);
    const program = await db.program.update({
      where: { id: params.id, userId },
      data: {
        name: data.name,
        phase: data.phase,
        description: data.description ?? null,
      },
    });
    return NextResponse.json(program);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    // onDelete: Cascade on Workout removes workouts + programExercises.
    // Linked Sessions have a nullable programId so they will be detached
    // (Prisma sets null by default on optional relations).
    await db.program.delete({ where: { id: params.id, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
