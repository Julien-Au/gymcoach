import { NextResponse } from 'next/server';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { db } from '@/lib/db';
import { deleteOwnedGymEquipment, upsertOwnedGymEquipment } from '@/lib/gym-equipment';
import { databaseIdSchema, gymEquipmentUpsertSchema } from '@/lib/schemas/gym-equipment';

interface Params {
  params: Promise<{ id: string }>;
}

function parseEquipmentId(id: string): string {
  const parsed = databaseIdSchema.safeParse(id);
  if (!parsed.success) throw new ApiError(400, 'Invalid equipment id.');
  return parsed.data;
}

export async function PUT(req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    const equipmentId = parseEquipmentId(id);
    const existing = await db.gymEquipment.findFirst({
      where: { id: equipmentId, gym: { userId } },
      select: { id: true, gymId: true },
    });
    if (!existing) return NextResponse.json({ error: 'Gym equipment not found.' }, { status: 404 });
    const input = await parseJsonBody(req, gymEquipmentUpsertSchema);
    const saved = await upsertOwnedGymEquipment(userId, existing.gymId, {
      ...input,
      equipmentId: existing.id,
    });
    return NextResponse.json(saved);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    const equipmentId = parseEquipmentId(id);
    await deleteOwnedGymEquipment(userId, equipmentId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
