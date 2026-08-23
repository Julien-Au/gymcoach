import { NextResponse } from 'next/server';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { db } from '@/lib/db';
import { deleteOwnedGymEquipment, upsertOwnedGymEquipment } from '@/lib/gym-equipment';
import { gymEquipmentUpsertSchema } from '@/lib/schemas/gym-equipment';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    const existing = await db.gymEquipment.findFirst({
      where: { id, gym: { userId } },
      select: { id: true, gymId: true },
    });
    if (!existing) return NextResponse.json({ error: 'Gym equipment not found.' }, { status: 404 });
    const input = await parseJsonBody(req, gymEquipmentUpsertSchema);
    const saved = await upsertOwnedGymEquipment(userId, existing.gymId, {
      equipmentId: existing.id,
      ...input,
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
    await deleteOwnedGymEquipment(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
