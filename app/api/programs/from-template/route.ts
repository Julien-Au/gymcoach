import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { generatedProgramSchema } from '@/lib/schemas/program-generation';
import { buildProgramFromGenerated } from '@/lib/program-generation';

// Instantiating a template goes through the same persistence helper as the
// AI generator so exercise upserts never overwrite user-authored metadata.
// Unlike the generator flow, a picked template becomes the active program.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, generatedProgramSchema);

    const programId = await buildProgramFromGenerated(userId, data);
    await db.$transaction([
      db.program.updateMany({
        where: { userId, isActive: true, id: { not: programId } },
        data: { isActive: false },
      }),
      db.program.update({ where: { id: programId }, data: { isActive: true } }),
    ]);

    return NextResponse.json({ id: programId }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
