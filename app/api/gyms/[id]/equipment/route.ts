import { NextResponse } from 'next/server';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { listOwnedGymEquipment, upsertOwnedGymEquipment } from '@/lib/gym-equipment';
import { gymEquipmentUpsertSchema } from '@/lib/schemas/gym-equipment';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    return NextResponse.json({ equipment: await listOwnedGymEquipment(userId, id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    const input = await parseJsonBody(req, gymEquipmentUpsertSchema);
    const saved = await upsertOwnedGymEquipment(userId, id, input);
    return NextResponse.json(saved, { status: saved.created ? 201 : 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
