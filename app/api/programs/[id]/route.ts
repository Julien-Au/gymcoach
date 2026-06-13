import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programInputSchema } from '@/lib/schemas/program';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

async function ensureOwnership(id: string, userId: string) {
  const program = await db.program.findUnique({ where: { id } });
  if (!program || program.userId !== userId) {
    throw new ApiError(404, 'Program not found.');
  }
  return program;
}

export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    await ensureOwnership(params.id, userId);
    const program = await db.program.findUnique({
      where: { id: params.id },
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
    return NextResponse.json(program);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    await ensureOwnership(params.id, userId);
    const data = await parseJsonBody(req, programInputSchema);
    const program = await db.program.update({
      where: { id: params.id },
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
    await ensureOwnership(params.id, userId);
    // onDelete: Cascade on Workout removes workouts + programExercises.
    // Linked Sessions have a nullable programId so they will be detached
    // (Prisma sets null by default on optional relations).
    await db.program.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
