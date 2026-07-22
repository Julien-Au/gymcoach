import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Progress-photo routes (issue #269): a file-upload security surface, so this
// suite covers the hostile paths (oversize, wrong/disguised type, bad
// metadata) and the ownership boundary (a user can never read or delete
// another user's photo) on top of the happy paths.

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as listPhotos, POST as uploadPhoto } from '@/app/api/progress-photos/route';
import { DELETE as deletePhoto } from '@/app/api/progress-photos/[id]/route';
import { GET as getImage } from '@/app/api/progress-photos/[id]/image/route';
import { MAX_PROGRESS_PHOTO_BYTES } from '@/lib/progress-photo';

let uploadsDir = '';
const prevUploadsDir = process.env.UPLOADS_DIR;

beforeAll(async () => {
  // A fresh scratch dir per run so tests never touch a real uploads dir and
  // never collide with a previous run.
  uploadsDir = await mkdtemp(path.join(os.tmpdir(), 'gymcoach-photos-test-'));
  process.env.UPLOADS_DIR = uploadsDir;
});

afterAll(async () => {
  if (prevUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = prevUploadsDir;
  if (uploadsDir) await rm(uploadsDir, { recursive: true, force: true });
});

beforeEach(() => {
  mockUserId.mockReset();
});

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

// Minimal buffers with the correct magic bytes for each accepted format.
function jpegBytes(extra = 32): Uint8Array<ArrayBuffer> {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array(extra).fill(0x42)]);
}
function pngBytes(extra = 32): Uint8Array<ArrayBuffer> {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...Array(extra).fill(0x42),
  ]);
}
function webpBytes(extra = 32): Uint8Array<ArrayBuffer> {
  return Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, ...Array(extra).fill(0x42),
  ]);
}

function uploadReq(bytes: Uint8Array<ArrayBuffer>, query = ''): Request {
  return new Request(`http://test.local/api/progress-photos${query}`, {
    method: 'POST',
    // Deliberately lies about the type on some calls: the server must decide
    // from the magic bytes, never from this header.
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
}

function idParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function seedUsers() {
  const [a, b] = await Promise.all([
    db.user.create({ data: { email: 'owner@test.dev', passwordHash: 'x' } }),
    db.user.create({ data: { email: 'stranger@test.dev', passwordHash: 'x' } }),
  ]);
  return { a, b };
}

describe('POST /api/progress-photos - valid uploads', () => {
  it.each([
    ['JPEG', jpegBytes(), 'image/jpeg', 'jpg'],
    ['PNG', pngBytes(), 'image/png', 'png'],
    ['WebP', webpBytes(), 'image/webp', 'webp'],
  ] as const)(
    'accepts a %s upload: 201, row persisted, file on disk',
    async (_label, bytes, mime, ext) => {
      const { a } = await seedUsers();
      actAs(a.id);

      const res = await uploadPhoto(uploadReq(bytes));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.mimeType).toBe(mime);
      expect(body.byteSize).toBe(bytes.length);
      // The server filesystem layout never leaks to the client.
      expect(body.storagePath).toBeUndefined();

      const row = await db.progressPhoto.findUnique({ where: { id: body.id } });
      expect(row).not.toBeNull();
      expect(row!.userId).toBe(a.id);
      expect(row!.mimeType).toBe(mime);
      expect(row!.storagePath).toBe(`${a.id}/${body.id}.${ext}`);

      const abs = path.join(uploadsDir, 'progress-photos', row!.storagePath);
      expect(existsSync(abs)).toBe(true);
      expect(new Uint8Array(await readFile(abs))).toEqual(bytes);
      // Written non-executable, owner-only (0o600).
      const mode = (await stat(abs)).mode & 0o777;
      expect(mode).toBe(0o600);
    },
  );

  it('stores takenAt and the trimmed note from the query string', async () => {
    const { a } = await seedUsers();
    actAs(a.id);

    const takenAt = '2026-07-01T08:00:00.000Z';
    const res = await uploadPhoto(
      uploadReq(
        jpegBytes(),
        `?takenAt=${encodeURIComponent(takenAt)}&note=${encodeURIComponent('  end of cut ')}`,
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.takenAt).toBe(takenAt);
    expect(body.note).toBe('end of cut');
  });
});

describe('POST /api/progress-photos - hostile uploads', () => {
  it('rejects a body past the 8 MiB cap with 413 and stores nothing', async () => {
    const { a } = await seedUsers();
    actAs(a.id);

    const oversized = new Uint8Array(MAX_PROGRESS_PHOTO_BYTES + 1);
    oversized.set([0xff, 0xd8, 0xff]); // valid JPEG magic, still too big
    const res = await uploadPhoto(uploadReq(oversized));
    expect(res.status).toBe(413);
    expect(await db.progressPhoto.count()).toBe(0);
  });

  it.each([
    ['PDF magic', new TextEncoder().encode('%PDF-1.7 not an image')],
    ['plain text', new TextEncoder().encode('just some text pretending')],
    ['GIF magic', new TextEncoder().encode('GIF89a\x01\x00\x01\x00rest')],
  ] as const)('rejects %s with 415', async (_label, bytes) => {
    const { a } = await seedUsers();
    actAs(a.id);

    const res = await uploadPhoto(uploadReq(bytes));
    expect(res.status).toBe(415);
    expect((await res.json()).error).toMatch(/unsupported image type/i);
    expect(await db.progressPhoto.count()).toBe(0);
  });

  it('rejects a disguised upload (text bytes, image/png Content-Type header)', async () => {
    const { a } = await seedUsers();
    actAs(a.id);

    const res = await uploadPhoto(
      new Request('http://test.local/api/progress-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' }, // lies
        body: new TextEncoder().encode('<script>alert(1)</script>'),
      }),
    );
    expect(res.status).toBe(415);
  });

  it('rejects an empty body with 400', async () => {
    const { a } = await seedUsers();
    actAs(a.id);

    const res = await uploadPhoto(
      new Request('http://test.local/api/progress-photos', { method: 'POST' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a note longer than 500 chars with 400 (before reading the body)', async () => {
    const { a } = await seedUsers();
    actAs(a.id);

    const res = await uploadPhoto(
      uploadReq(jpegBytes(), `?note=${'x'.repeat(501)}`),
    );
    expect(res.status).toBe(400);
    expect(await db.progressPhoto.count()).toBe(0);
  });

  it.each([
    ['unparseable', 'not-a-date'],
    ['out of the Postgres range', '+275760-09-13T00:00:00.000Z'],
  ] as const)('rejects a takenAt that is %s with 400', async (_label, takenAt) => {
    const { a } = await seedUsers();
    actAs(a.id);

    const res = await uploadPhoto(
      uploadReq(jpegBytes(), `?takenAt=${encodeURIComponent(takenAt)}`),
    );
    expect(res.status).toBe(400);
    expect(await db.progressPhoto.count()).toBe(0);
  });

  it('rejects an unauthenticated upload with 401', async () => {
    mockUserId.mockResolvedValue(null);
    const res = await uploadPhoto(uploadReq(jpegBytes()));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/progress-photos - own photos only, newest first', () => {
  it('lists only the caller rows, ordered by takenAt desc, without storagePath', async () => {
    const { a, b } = await seedUsers();

    actAs(a.id);
    await uploadPhoto(uploadReq(jpegBytes(), '?takenAt=2026-06-01T00:00:00.000Z'));
    await uploadPhoto(uploadReq(pngBytes(), '?takenAt=2026-07-01T00:00:00.000Z'));
    actAs(b.id);
    await uploadPhoto(uploadReq(webpBytes(), '?takenAt=2026-06-15T00:00:00.000Z'));

    actAs(a.id);
    const res = await listPhotos();
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(rows).toHaveLength(2);
    expect(rows.map((r: { takenAt: string }) => r.takenAt)).toEqual([
      '2026-07-01T00:00:00.000Z',
      '2026-06-01T00:00:00.000Z',
    ]);
    for (const row of rows) {
      expect(row.storagePath).toBeUndefined();
    }
  });
});

describe('GET /api/progress-photos/[id]/image - ownership-scoped serving', () => {
  it('returns the stored bytes with the sniffed Content-Type and no-store headers for the owner', async () => {
    const { a } = await seedUsers();
    actAs(a.id);
    const bytes = pngBytes(64);
    const { id } = await (await uploadPhoto(uploadReq(bytes))).json();

    const res = await getImage(
      new Request(`http://test.local/api/progress-photos/${id}/image`),
      idParams(id),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Disposition')).toBe('inline');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("answers 404 (not 403) when user B requests user A's image", async () => {
    const { a, b } = await seedUsers();
    actAs(a.id);
    const { id } = await (await uploadPhoto(uploadReq(jpegBytes()))).json();

    actAs(b.id);
    const res = await getImage(
      new Request(`http://test.local/api/progress-photos/${id}/image`),
      idParams(id),
    );
    expect(res.status).toBe(404);
  });

  it('answers 404 for a missing id and for a row whose file is gone from disk', async () => {
    const { a } = await seedUsers();
    actAs(a.id);

    const missing = await getImage(
      new Request('http://test.local/api/progress-photos/nope/image'),
      idParams('nope'),
    );
    expect(missing.status).toBe(404);

    const { id } = await (await uploadPhoto(uploadReq(jpegBytes()))).json();
    const row = await db.progressPhoto.findUnique({ where: { id } });
    await rm(path.join(uploadsDir, 'progress-photos', row!.storagePath));
    const gone = await getImage(
      new Request(`http://test.local/api/progress-photos/${id}/image`),
      idParams(id),
    );
    expect(gone.status).toBe(404);
  });
});

describe('DELETE /api/progress-photos/[id] - ownership-scoped delete', () => {
  it('lets the owner delete a photo: row and file both removed', async () => {
    const { a } = await seedUsers();
    actAs(a.id);
    const { id } = await (await uploadPhoto(uploadReq(jpegBytes()))).json();
    const row = await db.progressPhoto.findUnique({ where: { id } });
    const abs = path.join(uploadsDir, 'progress-photos', row!.storagePath);
    expect(existsSync(abs)).toBe(true);

    const res = await deletePhoto(
      new Request('http://test.local', { method: 'DELETE' }),
      idParams(id),
    );
    expect(res.status).toBe(200);
    expect(await db.progressPhoto.findUnique({ where: { id } })).toBeNull();
    expect(existsSync(abs)).toBe(false);
  });

  it("answers 404 and keeps row + file when user B deletes user A's photo", async () => {
    const { a, b } = await seedUsers();
    actAs(a.id);
    const { id } = await (await uploadPhoto(uploadReq(jpegBytes()))).json();
    const row = await db.progressPhoto.findUnique({ where: { id } });
    const abs = path.join(uploadsDir, 'progress-photos', row!.storagePath);

    actAs(b.id);
    const res = await deletePhoto(
      new Request('http://test.local', { method: 'DELETE' }),
      idParams(id),
    );
    expect(res.status).toBe(404);
    expect(await db.progressPhoto.findUnique({ where: { id } })).not.toBeNull();
    expect(existsSync(abs)).toBe(true);
  });

  it('still deletes the row when the file is already gone from disk', async () => {
    const { a } = await seedUsers();
    actAs(a.id);
    const { id } = await (await uploadPhoto(uploadReq(jpegBytes()))).json();
    const row = await db.progressPhoto.findUnique({ where: { id } });
    await rm(path.join(uploadsDir, 'progress-photos', row!.storagePath));

    const res = await deletePhoto(
      new Request('http://test.local', { method: 'DELETE' }),
      idParams(id),
    );
    expect(res.status).toBe(200);
    expect(await db.progressPhoto.findUnique({ where: { id } })).toBeNull();
  });
});
