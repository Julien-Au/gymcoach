import { NextResponse } from 'next/server';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { buildProgramFromGenerated } from '@/lib/program-generation';
import { generatedProgramSchema } from '@/lib/schemas/program-generation';

export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const program = await parseJsonBody(req, generatedProgramSchema);
    const id = await buildProgramFromGenerated(userId, program);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
