import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { gymCreateSchema } from '@/lib/schemas/gym';
import { validateGymExerciseConfigs } from '@/lib/gym-data';

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const [user, gyms] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { activeGymId: true } }),
      db.gym.findMany({
        where: { userId },
        orderBy: [{ name: 'asc' }],
        include: { exerciseConfigs: true },
      }),
    ]);
    return NextResponse.json({ activeGymId: user?.activeGymId ?? null, gyms });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const input = await parseJsonBody(req, gymCreateSchema);
    const exerciseConfigs = await validateGymExerciseConfigs(userId, input.exerciseConfigs);

    const created = await db.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: {
          userId,
          name: input.name,
          dumbbellWeights: input.dumbbellWeights,
          plateWeights: input.plateWeights,
          barWeights: input.barWeights,
          exerciseConfigs: { createMany: { data: exerciseConfigs } },
        },
        include: { exerciseConfigs: true },
      });
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { activeGymId: true },
      });
      if (input.makeActive || !user?.activeGymId) {
        await tx.user.update({ where: { id: userId }, data: { activeGymId: gym.id } });
      }
      return gym;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
