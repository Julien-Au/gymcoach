import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';
import { deletePhotoFile } from '@/lib/progress-photo';

interface Params {
  params: Promise<{ id: string }>;
}

// DELETE /api/progress-photos/[id] : remove one photo (row + file).
// Ownership-scoped: a photo that does not exist and a photo owned by another
// user both answer 404, so the route leaks no existence information. The row
// is deleted first (the source of truth); a missing file on disk is tolerated
// so a half-cleaned uploads dir cannot wedge deletion.
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const photo = await db.progressPhoto.findUnique({
      where: { id: params.id },
    });
    if (!photo || photo.userId !== userId) {
      throw new ApiError(404, 'Photo not found.');
    }

    await db.progressPhoto.delete({ where: { id: photo.id } });
    await deletePhotoFile(photo.storagePath);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
