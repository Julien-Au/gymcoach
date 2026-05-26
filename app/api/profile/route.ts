import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Sex, TrainingGoal } from '@prisma/client';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

// User profile (self-service). Every field is optional; null clears a value.
const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(80).nullable().optional(),
  // Bodyweight in kg, used to compute the effective tonnage on bodyweight
  // exercises. null reverts to the set.weight-only behavior.
  bodyweight: z.number().min(20, 'Too low').max(300, 'Too high').nullable().optional(),
  sex: z.nativeEnum(Sex).nullable().optional(),
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  goal: z.nativeEnum(TrainingGoal).nullable().optional(),
  weeklyFrequency: z.number().int().min(1).max(14).nullable().optional(),
});

const PROFILE_SELECT = {
  email: true,
  displayName: true,
  bodyweight: true,
  sex: true,
  heightCm: true,
  goal: true,
  weeklyFrequency: true,
} as const;

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const user = await db.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    return NextResponse.json(user);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, profileUpdateSchema);
    const updated = await db.user.update({
      where: { id: userId },
      data: {
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.bodyweight !== undefined ? { bodyweight: data.bodyweight } : {}),
        ...(data.sex !== undefined ? { sex: data.sex } : {}),
        ...(data.heightCm !== undefined ? { heightCm: data.heightCm } : {}),
        ...(data.goal !== undefined ? { goal: data.goal } : {}),
        ...(data.weeklyFrequency !== undefined
          ? { weeklyFrequency: data.weeklyFrequency }
          : {}),
      },
      select: PROFILE_SELECT,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
