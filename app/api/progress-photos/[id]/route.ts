import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';
import { deletePhotoFile } from '@/lib/progress-photo';

interface Params {
  params: Promise<{ id: string }>;
}

// DELETE /api/progress-photos/[id] : remove one photo (row + file).
// Ownership-scoped: a photo that does not exist and a photo owned by another
// user both answer 404, so the route leaks no existence information. The file
// is unlinked BEFORE the row (issue #282): a missing file is tolerated, but any
// other unlink failure (EACCES, EIO) must leave the row in place, so the photo
// stays listed and retryable instead of orphaning bytes no row points at.
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

    await deletePhotoFile(photo.storagePath);
    await db.progressPhoto.delete({ where: { id: photo.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
