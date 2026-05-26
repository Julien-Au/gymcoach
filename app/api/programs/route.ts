import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programInputSchema } from '@/lib/schemas/program';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

export async function GET(req: Request) {
  try {
    const userId = await requireApiUserId();
    const { searchParams } = new URL(req.url);
    const onlyActive = searchParams.get('active') === 'true';

    const programs = await db.program.findMany({
      where: { userId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      include: {
        _count: { select: { workouts: true, sessions: true } },
      },
    });
    return NextResponse.json(programs);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, programInputSchema);
    const program = await db.program.create({
      data: {
        userId,
        name: data.name,
        phase: data.phase,
        description: data.description ?? null,
        isActive: false,
      },
    });
    return NextResponse.json(program, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
