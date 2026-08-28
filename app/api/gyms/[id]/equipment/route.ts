import { NextResponse } from 'next/server';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { listOwnedGymEquipment, upsertOwnedGymEquipment } from '@/lib/gym-equipment';
import { databaseIdSchema, gymEquipmentUpsertSchema } from '@/lib/schemas/gym-equipment';

interface Params {
  params: Promise<{ id: string }>;
}

function parseGymId(id: string): string {
  const parsed = databaseIdSchema.safeParse(id);
  if (!parsed.success) throw new ApiError(400, 'Invalid gym id.');
  return parsed.data;
}

export async function GET(_req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    const gymId = parseGymId(id);
    return NextResponse.json({ equipment: await listOwnedGymEquipment(userId, gymId) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    const gymId = parseGymId(id);
    const input = await parseJsonBody(req, gymEquipmentUpsertSchema);
    const saved = await upsertOwnedGymEquipment(userId, gymId, input);
    return NextResponse.json(saved, { status: saved.created ? 201 : 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
