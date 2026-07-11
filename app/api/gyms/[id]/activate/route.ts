import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, props: Params) {
  const { id } = await props.params;
  try {
    const userId = await requireApiUserId();
    const gym = await db.gym.findFirst({ where: { id, userId }, select: { id: true } });
    if (!gym) throw new ApiError(404, 'Gym not found.');
    await db.user.update({ where: { id: userId }, data: { activeGymId: id } });
    return NextResponse.json({ activeGymId: id });
  } catch (err) {
    return handleApiError(err);
  }
}
