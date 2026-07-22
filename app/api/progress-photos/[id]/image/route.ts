import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';
import { readPhotoFile } from '@/lib/progress-photo';

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/progress-photos/[id]/image : the photo bytes, owner only.
// This is the ONLY way photo bytes leave the box - the uploads dir is never
// exposed as a public static path. Ownership-scoped: not-found and
// not-yours both answer 404 (no existence leak). Headers:
// - Content-Type is the STORED, sniffed mime (an allowlisted image type,
//   never client input) and X-Content-Type-Options: nosniff pins it.
// - Content-Disposition: inline renders in <img> tags.
// - Cache-Control: private, no-store keeps body photos out of shared caches.
export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const photo = await db.progressPhoto.findUnique({
      where: { id: params.id },
    });
    if (!photo || photo.userId !== userId) {
      throw new ApiError(404, 'Photo not found.');
    }

    const bytes = await readPhotoFile(photo.storagePath);
    if (!bytes) {
      // Row exists but the file is gone from disk (operator moved/lost the
      // uploads dir): a clean 404, not a 500.
      throw new ApiError(404, 'Photo file not found.');
    }

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': photo.mimeType,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
