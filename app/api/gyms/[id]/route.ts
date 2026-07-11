import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { gymUpdateSchema } from '@/lib/schemas/gym';
import { validateGymExerciseConfigs } from '@/lib/gym-data';

interface Params {
  params: Promise<{ id: string }>;
}

async function requireOwnedGym(id: string, userId: string) {
  const gym = await db.gym.findFirst({ where: { id, userId } });
  if (!gym) throw new ApiError(404, 'Gym not found.');
  return gym;
}

export async function PUT(req: Request, props: Params) {
  const { id } = await props.params;
  try {
    const userId = await requireApiUserId();
    await requireOwnedGym(id, userId);
    const input = await parseJsonBody(req, gymUpdateSchema);
    const exerciseConfigs = await validateGymExerciseConfigs(userId, input.exerciseConfigs);

    const updated = await db.$transaction(async (tx) => {
      await tx.gymExerciseConfig.deleteMany({ where: { gymId: id } });
      return tx.gym.update({
        where: { id },
        data: {
          name: input.name,
          dumbbellWeights: input.dumbbellWeights,
          plateWeights: input.plateWeights,
          barWeights: input.barWeights,
          exerciseConfigs: { createMany: { data: exerciseConfigs } },
        },
        include: { exerciseConfigs: true },
      });
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, props: Params) {
  const { id } = await props.params;
  try {
    const userId = await requireApiUserId();
    await requireOwnedGym(id, userId);
    await db.$transaction(async (tx) => {
      await tx.gym.delete({ where: { id } });
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { activeGymId: true },
      });
      if (!user?.activeGymId) {
        const replacement = await tx.gym.findFirst({ where: { userId }, orderBy: { name: 'asc' } });
        if (replacement) {
          await tx.user.update({ where: { id: userId }, data: { activeGymId: replacement.id } });
        }
      }
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
