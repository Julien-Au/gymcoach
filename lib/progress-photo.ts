import { chmod, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// ============================================================
// Progress-photo storage (issue #269)
// ============================================================
// Local-only file storage for progress photos, plus the content sniffing the
// upload route relies on. Security posture:
// - The accepted formats are a hard ALLOWLIST (jpeg/png/webp), decided by the
//   file's magic bytes only - the client-declared Content-Type is never
//   trusted, so a disguised extension or spoofed header changes nothing.
// - Files are written non-executable (0o600) under a gitignored uploads dir,
//   which is never exposed as a public static path; every read goes through
//   an ownership-scoped API route.
// - Stored paths are RELATIVE to the storage dir and re-resolved on every
//   access with a containment check, so a corrupted/hostile DB value can
//   never escape the uploads dir.

export type ProgressPhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

// 8 MiB: generous for a phone photo, small enough to buffer in memory. The
// upload route enforces this DURING the body read (413 past the cap).
export const MAX_PROGRESS_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PROGRESS_PHOTO_NOTE = 500;

// Magic-byte detection over the accepted image formats. Anything that does
// not match one of the three signatures - including GIF, PDF, SVG, plain
// text, or a truncated header - returns null and must be rejected.
export function sniffImageType(bytes: Uint8Array): ProgressPhotoMime | null {
  // JPEG: FF D8 FF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && pngSig.every((b, i) => bytes[i] === b)) {
    return 'image/png';
  }
  // WebP: 'RIFF' at 0..3 and 'WEBP' at 8..11 (4..7 is the chunk size).
  const riff = [0x52, 0x49, 0x46, 0x46]; // 'RIFF'
  const webp = [0x57, 0x45, 0x42, 0x50]; // 'WEBP'
  if (
    bytes.length >= 12 &&
    riff.every((b, i) => bytes[i] === b) &&
    webp.every((b, i) => bytes[8 + i] === b)
  ) {
    return 'image/webp';
  }
  return null;
}

export function extensionForMime(mime: ProgressPhotoMime): 'jpg' | 'png' | 'webp' {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
  }
}

// Root dir for progress-photo files: <UPLOADS_DIR>/progress-photos, resolved
// at call time so tests can point UPLOADS_DIR at a scratch dir. Defaults to
// ./uploads (gitignored) for self-hosters who do not configure it.
export function progressPhotoStorageDir(): string {
  return path.resolve(process.env.UPLOADS_DIR ?? './uploads', 'progress-photos');
}

// Storage path of one photo, RELATIVE to progressPhotoStorageDir(). Both ids
// are server-generated (cuid/uuid), but resolveInsideStorageDir re-checks
// containment anyway.
export function photoRelativePath(
  userId: string,
  photoId: string,
  mime: ProgressPhotoMime,
): string {
  return path.join(userId, `${photoId}.${extensionForMime(mime)}`);
}

// Real path of the deepest component of `target` that exists on disk. A path
// being written for the first time has no realpath of its own, so containment
// is checked against the nearest existing ancestor - which is where a symlink
// would have to sit to redirect the write.
async function realPathOfNearestExisting(target: string): Promise<string> {
  let current = target;
  for (;;) {
    try {
      return await realpath(current);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      const parent = path.dirname(current);
      if (parent === current) return current; // filesystem root
      current = parent;
    }
  }
}

// Defense-in-depth: resolve a stored relative path against the storage dir
// and refuse anything that escapes it (absolute paths, ..-traversal). The
// textual check is followed by a symlink-aware one (issue #282): path.resolve
// normalizes text only, so a symlinked component would still point outside
// the uploads dir. Not exploitable today - planting one inside the uploads
// dir already requires arbitrary write - but it keeps containment true for
// any future feature that lets a user influence a stored path.
async function resolveInsideStorageDir(relPath: string): Promise<string> {
  const dir = progressPhotoStorageDir();
  const abs = path.resolve(dir, relPath);
  if (abs !== dir && !abs.startsWith(dir + path.sep)) {
    throw new Error('Progress-photo path escapes the uploads dir.');
  }
  const realDir = await realPathOfNearestExisting(dir);
  const realAbs = await realPathOfNearestExisting(abs);
  if (realAbs !== realDir && !realAbs.startsWith(realDir + path.sep)) {
    throw new Error('Progress-photo path escapes the uploads dir.');
  }
  return abs;
}

// Writes the photo bytes, creating the per-user dir as needed. Mode 0o600 on
// the file and 0o700 on its dir: owner-only, never executable. The dir mode is
// applied with an explicit chmod because mkdir's mode is masked by the process
// umask and does not touch a dir created by an earlier version.
export async function writePhotoFile(
  relPath: string,
  bytes: Uint8Array,
): Promise<void> {
  const abs = await resolveInsideStorageDir(relPath);
  const dir = path.dirname(abs);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  await writeFile(abs, bytes, { mode: 0o600 });
}

// Reads the photo bytes; null when the file is missing on disk (the serving
// route turns that into a 404 rather than a 500).
export async function readPhotoFile(relPath: string): Promise<Uint8Array | null> {
  const abs = await resolveInsideStorageDir(relPath);
  try {
    return new Uint8Array(await readFile(abs));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

// Removes the photo file; a missing file is fine (force: true), so deleting a
// row whose file is already gone still succeeds. Anything else (EACCES, EIO)
// throws, so the caller can keep the row rather than orphan the file.
export async function deletePhotoFile(relPath: string): Promise<void> {
  const abs = await resolveInsideStorageDir(relPath);
  await rm(abs, { force: true });
}
