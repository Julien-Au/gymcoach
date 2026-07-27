import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Delete ordering on the progress-photo route (issue #282): the file is
// unlinked before its row, so an unlink failure that is NOT "already gone"
// leaves the row in place. Without that ordering the row would be deleted and
// the bytes would orphan on disk with nothing pointing at them.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

// vi.hoisted so the mock function exists before the module factory runs.
const { deleteFileMock } = vi.hoisted(() => ({ deleteFileMock: vi.fn() }));
vi.mock('@/lib/progress-photo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/progress-photo')>();
  return { ...actual, deletePhotoFile: deleteFileMock };
});

import { DELETE as deletePhoto } from '@/app/api/progress-photos/[id]/route';

beforeEach(() => {
  mockUserId.mockReset();
  deleteFileMock.mockReset();
});

async function seedPhoto(email: string) {
  const user = await db.user.create({ data: { email, passwordHash: 'x' } });
  const photo = await db.progressPhoto.create({
    data: {
      userId: user.id,
      storagePath: `${user.id}/photo.jpg`,
      mimeType: 'image/jpeg',
      byteSize: 128,
      takenAt: new Date('2026-07-01T00:00:00.000Z'),
    },
  });
  return { user, photo };
}

function req(id: string) {
  return {
    request: new Request(`http://test.local/api/progress-photos/${id}`, { method: 'DELETE' }),
    props: { params: Promise.resolve({ id }) },
  };
}

describe('DELETE /api/progress-photos/[id] - file deletion failure (issue #282)', () => {
  it('keeps the row when unlinking the file fails for a reason other than ENOENT', async () => {
    const { user, photo } = await seedPhoto('eacces@test.dev');
    mockUserId.mockResolvedValue(user.id);
    deleteFileMock.mockRejectedValue(
      Object.assign(new Error('permission denied'), { code: 'EACCES' }),
    );

    const { request, props } = req(photo.id);
    const res = await deletePhoto(request, props);

    expect(res.status).toBe(500);
    // Still listed, so the user can retry instead of losing track of the file.
    expect(await db.progressPhoto.findUnique({ where: { id: photo.id } })).not.toBeNull();
  });

  it('deletes the row once the file is gone', async () => {
    const { user, photo } = await seedPhoto('ok@test.dev');
    mockUserId.mockResolvedValue(user.id);
    deleteFileMock.mockResolvedValue(undefined);

    const { request, props } = req(photo.id);
    const res = await deletePhoto(request, props);

    expect(res.status).toBe(200);
    expect(deleteFileMock).toHaveBeenCalledWith(photo.storagePath);
    expect(await db.progressPhoto.findUnique({ where: { id: photo.id } })).toBeNull();
  });
});
