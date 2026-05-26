import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

// User profile (self-service). Single-user, so no admin/role check.

const profileUpdateSchema = z.object({
  // Bodyweight in kg. null = clear the value (reverts to the pre-bodyweight
  // behavior where the tonnage of bodyweight exercises stays based on
  // set.weight alone).
  bodyweight: z
    .number()
    .min(20, 'Too low')
    .max(300, 'Too high')
    .nullable()
    .optional(),
});

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, bodyweight: true },
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
        ...(data.bodyweight !== undefined ? { bodyweight: data.bodyweight } : {}),
      },
      select: { email: true, bodyweight: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
