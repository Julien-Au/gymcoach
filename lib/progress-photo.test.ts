import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { mkdtemp, mkdir, rm, stat, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  deletePhotoFile,
  extensionForMime,
  MAX_PROGRESS_PHOTO_BYTES,
  photoRelativePath,
  progressPhotoStorageDir,
  sniffImageType,
  writePhotoFile,
} from './progress-photo';

// Builders for the accepted signatures, padded with arbitrary payload bytes
// so the buffers look like the start of a real file, not just a bare header.
function jpegBytes(extra = 16): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array(extra).fill(0x42)]);
}
function pngBytes(extra = 16): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...Array(extra).fill(0x42),
  ]);
}
function webpBytes(extra = 16): Uint8Array {
  // 'RIFF' + 4 size bytes + 'WEBP' + payload.
  return Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, ...Array(extra).fill(0x42),
  ]);
}

describe('sniffImageType', () => {
  it('detects JPEG from its FF D8 FF signature', () => {
    expect(sniffImageType(jpegBytes())).toBe('image/jpeg');
  });

  it('detects PNG from its 8-byte signature', () => {
    expect(sniffImageType(pngBytes())).toBe('image/png');
  });

  it('detects WebP from RIFF....WEBP', () => {
    expect(sniffImageType(webpBytes())).toBe('image/webp');
  });

  it('rejects plain text', () => {
    expect(sniffImageType(new TextEncoder().encode('hello, not an image'))).toBeNull();
  });

  it('rejects a PDF (%PDF- magic)', () => {
    expect(sniffImageType(new TextEncoder().encode('%PDF-1.7 ...'))).toBeNull();
  });

  it('rejects a GIF (GIF89a magic) - not in the allowlist', () => {
    expect(sniffImageType(new TextEncoder().encode('GIF89a\x01\x00\x01\x00'))).toBeNull();
  });

  it('rejects an SVG (scriptable image, not in the allowlist)', () => {
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="..."></svg>'))).toBeNull();
  });

  it('rejects empty and 1-byte buffers without throwing', () => {
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
    expect(sniffImageType(Uint8Array.from([0xff]))).toBeNull();
  });

  it('rejects truncated headers (PNG cut at 7 bytes, WebP cut before WEBP)', () => {
    expect(sniffImageType(pngBytes().slice(0, 7))).toBeNull();
    // 'RIFF' + size but cut before the 'WEBP' tag at bytes 8..11.
    expect(sniffImageType(webpBytes().slice(0, 11))).toBeNull();
  });

  it('rejects RIFF containers that are not WebP (e.g. WAVE audio)', () => {
    const wave = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, // 'WAVE'
    ]);
    expect(sniffImageType(wave)).toBeNull();
  });

  it('is not fooled by a signature placed past offset 0 (disguised bytes)', () => {
    const disguised = Uint8Array.from([0x00, ...jpegBytes()]);
    expect(sniffImageType(disguised)).toBeNull();
  });
});

describe('extensionForMime', () => {
  it('maps each allowed mime to its extension', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/png')).toBe('png');
    expect(extensionForMime('image/webp')).toBe('webp');
  });
});

describe('photoRelativePath', () => {
  it('builds <userId>/<photoId>.<ext>', () => {
    expect(photoRelativePath('user1', 'photo1', 'image/png')).toBe(
      'user1/photo1.png',
    );
  });
});

describe('MAX_PROGRESS_PHOTO_BYTES', () => {
  it('is 8 MiB', () => {
    expect(MAX_PROGRESS_PHOTO_BYTES).toBe(8 * 1024 * 1024);
  });
});


// Storage containment and file permissions (issue #282). These touch a scratch
// uploads dir; nothing outside it is created or read.
describe('photo file storage', () => {
  let scratch = '';
  const prevUploadsDir = process.env.UPLOADS_DIR;

  beforeAll(async () => {
    scratch = await mkdtemp(path.join(os.tmpdir(), 'gymcoach-photo-storage-'));
    process.env.UPLOADS_DIR = path.join(scratch, 'uploads');
  });

  afterAll(async () => {
    if (prevUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = prevUploadsDir;
    if (scratch) await rm(scratch, { recursive: true, force: true });
  });

  it('writes the file 0o600 and its per-user dir 0o700', async () => {
    const rel = photoRelativePath('user-1', 'photo-1', 'image/jpeg');
    await writePhotoFile(rel, Uint8Array.from([0xff, 0xd8, 0xff]));

    const abs = path.join(progressPhotoStorageDir(), rel);
    expect((await stat(abs)).mode & 0o777).toBe(0o600);
    expect((await stat(path.dirname(abs))).mode & 0o777).toBe(0o700);
  });

  it('tightens a per-user dir left behind with looser permissions', async () => {
    const dir = path.join(progressPhotoStorageDir(), 'user-legacy');
    await mkdir(dir, { recursive: true, mode: 0o755 });

    await writePhotoFile(
      photoRelativePath('user-legacy', 'photo-2', 'image/png'),
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    );
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
  });

  it('refuses a stored path that escapes the uploads dir', async () => {
    await expect(writePhotoFile('../escaped.jpg', new Uint8Array(1))).rejects.toThrow(
      /escapes the uploads dir/,
    );
    await expect(deletePhotoFile('/etc/passwd')).rejects.toThrow(/escapes the uploads dir/);
  });

  it('refuses a path whose directory is a symlink pointing outside', async () => {
    const outside = path.join(scratch, 'outside');
    await mkdir(outside, { recursive: true });
    await mkdir(progressPhotoStorageDir(), { recursive: true });
    await symlink(outside, path.join(progressPhotoStorageDir(), 'linked-user'));

    // Textually inside the uploads dir, really not: only the realpath check
    // catches this one.
    await expect(
      writePhotoFile('linked-user/photo-3.jpg', new Uint8Array(1)),
    ).rejects.toThrow(/escapes the uploads dir/);
  });
});
