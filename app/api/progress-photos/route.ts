import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  ApiError,
  handleApiError,
  readBodyBytesWithCap,
  requireApiUserId,
} from '@/lib/api';
import {
  deletePhotoFile,
  MAX_PROGRESS_PHOTO_BYTES,
  photoRelativePath,
  sniffImageType,
  writePhotoFile,
} from '@/lib/progress-photo';
import { progressPhotoUploadQuerySchema } from '@/lib/schemas/progress-photo';

// Metadata the API exposes about a photo. storagePath (server filesystem
// layout) and the bytes themselves are deliberately never returned here; the
// bytes are only served by the ownership-scoped image route.
const PHOTO_SELECT = {
  id: true,
  takenAt: true,
  note: true,
  mimeType: true,
  byteSize: true,
} as const;

// GET /api/progress-photos : the caller's own photos, newest first.
export async function GET() {
  try {
    const userId = await requireApiUserId();
    const photos = await db.progressPhoto.findMany({
      where: { userId },
      orderBy: { takenAt: 'desc' },
      select: PHOTO_SELECT,
    });
    return NextResponse.json(photos);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/progress-photos?takenAt=<ISO>&note=<text> : upload one photo.
// The body is the RAW image bytes (not multipart), so the 8 MiB cap is
// enforced WHILE reading the stream (413 past it, before buffering more).
// Security controls (issue #269):
// - The accepted type is decided by magic-byte sniffing over a jpeg/png/webp
//   allowlist; the client Content-Type header is ignored entirely.
// - The row is always created under the authenticated user; the file lands
//   under a per-user dir inside the gitignored uploads dir, mode 0o600.
// - If the DB write fails after the file was written, the file is removed
//   again so no orphan bytes accumulate on disk.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();

    const url = new URL(req.url);
    const parsedQuery = progressPhotoUploadQuerySchema.safeParse({
      takenAt: url.searchParams.get('takenAt') ?? undefined,
      note: url.searchParams.get('note') ?? undefined,
    });
    if (!parsedQuery.success) {
      throw new ApiError(
        400,
        parsedQuery.error.issues[0]?.message ?? 'Invalid photo metadata',
      );
    }
    const { takenAt, note } = parsedQuery.data;

    const bytes = await readBodyBytesWithCap(req, MAX_PROGRESS_PHOTO_BYTES);
    if (bytes.length === 0) {
      throw new ApiError(400, 'Empty request body: send the image bytes.');
    }
    const mime = sniffImageType(bytes);
    if (!mime) {
      throw new ApiError(415, 'Unsupported image type. Use JPEG, PNG or WebP.');
    }

    // The id doubles as the filename, so it is generated up front. cuid ids
    // and UUIDs coexist fine in the TEXT primary key column.
    const id = randomUUID();
    const storagePath = photoRelativePath(userId, id, mime);
    await writePhotoFile(storagePath, bytes);
    try {
      const photo = await db.progressPhoto.create({
        data: {
          id,
          userId,
          ...(takenAt ? { takenAt: new Date(takenAt) } : {}),
          storagePath,
          mimeType: mime,
          byteSize: bytes.length,
          note: note ? note : null,
        },
        select: PHOTO_SELECT,
      });
      return NextResponse.json(photo, { status: 201 });
    } catch (err) {
      // The file was written but the row was not: remove the orphan file.
      await deletePhotoFile(storagePath).catch(() => {});
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
}
