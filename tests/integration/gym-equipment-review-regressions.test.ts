import { Buffer } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { MAX_GYM_EQUIPMENT_PER_GYM } from '@/lib/gym-equipment';

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as restoreBackup } from '@/app/api/backup/route';
import { POST as upsertEquipment } from '@/app/api/gyms/[id]/equipment/route';

let seed = 0;

function request(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function seedUser(label: string) {
  seed += 1;
  const user = await db.user.create({
    data: {
      email: `equipment-review-${label}-${Date.now()}-${seed}@test.dev`,
      passwordHash: 'unused',
    },
  });
  const gym = await db.gym.create({ data: { userId: user.id, name: `${label} gym ${seed}` } });
  return { user, gym };
}

beforeEach(() => mockUserId.mockReset());

describe('gym equipment maintainer-review regressions', () => {
  it('returns 200 for a name-matched update and preserves omitted mutable fields', async () => {
    const { user, gym } = await seedUser('preserve');
    const exercise = await db.exercise.create({
      data: {
        userId: user.id,
        name: `Cable row ${seed}`,
        muscleGroup: 'BACK_THICKNESS',
        category: 'COMPOUND',
        equipmentType: 'CABLE',
      },
    });
    const existing = await db.gymEquipment.create({
      data: {
        gymId: gym.id,
        name: 'Cable station',
        equipmentType: 'CABLE',
        quantity: 3,
        weightOptions: [10, 20],
        exerciseLinks: { create: { exerciseId: exercise.id } },
      },
    });
    mockUserId.mockResolvedValue(user.id);

    const response = await upsertEquipment(
      request(`http://test.local/api/gyms/${gym.id}/equipment`, 'POST', {
        name: 'CABLE STATION',
        equipmentType: 'CABLE',
      }),
      params(gym.id),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).created).toBe(false);
    const saved = await db.gymEquipment.findUnique({
      where: { id: existing.id },
      include: { exerciseLinks: true },
    });
    expect(saved).toMatchObject({ quantity: 3, weightOptions: [10, 20] });
    expect(saved?.exerciseLinks.map((link) => link.exerciseId)).toEqual([exercise.id]);
  });

  it('enforces the per-gym REST creation cap without blocking updates', async () => {
    const { user, gym } = await seedUser('cap');
    await db.gymEquipment.createMany({
      data: Array.from({ length: MAX_GYM_EQUIPMENT_PER_GYM }, (_, index) => ({
        gymId: gym.id,
        name: `Station ${index}`,
        equipmentType: 'MACHINE' as const,
      })),
    });
    mockUserId.mockResolvedValue(user.id);

    const updateResponse = await upsertEquipment(
      request(`http://test.local/api/gyms/${gym.id}/equipment`, 'POST', {
        name: 'Station 0',
        equipmentType: 'MACHINE',
        description: 'Still editable at the cap',
      }),
      params(gym.id),
    );
    expect(updateResponse.status).toBe(200);

    const createResponse = await upsertEquipment(
      request(`http://test.local/api/gyms/${gym.id}/equipment`, 'POST', {
        name: 'One station too many',
        equipmentType: 'MACHINE',
      }),
      params(gym.id),
    );
    expect(createResponse.status).toBe(400);
    expect(await db.gymEquipment.count({ where: { gymId: gym.id } })).toBe(
      MAX_GYM_EQUIPMENT_PER_GYM,
    );
  });

  it('rejects malformed backup equipment images before replacing existing data', async () => {
    const { user } = await seedUser('preflight');
    const existingExercise = await db.exercise.create({
      data: {
        userId: user.id,
        name: `Keep me ${seed}`,
        muscleGroup: 'CHEST',
        category: 'COMPOUND',
      },
    });
    mockUserId.mockResolvedValue(user.id);

    const response = await restoreBackup(
      request('http://test.local/api/backup', 'POST', {
        confirmReplace: true,
        payload: {
          version: 4,
          exercises: [],
          programs: [],
          sessions: [],
          gyms: [
            {
              name: 'Imported gym',
              dumbbellWeights: [],
              plateWeights: [],
              barWeights: [],
              exerciseConfigs: [],
              equipment: [
                {
                  name: 'Tampered station',
                  equipmentType: 'MACHINE',
                  description: null,
                  manufacturer: null,
                  modelName: null,
                  quantity: 1,
                  weightOptions: [],
                  imageUrl: null,
                  imageMimeType: 'image/png',
                  imageBase64: Buffer.from('not a png').toString('base64'),
                  exerciseNames: [],
                },
              ],
            },
          ],
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await db.exercise.findUnique({ where: { id: existingExercise.id } })).not.toBeNull();
    expect(await db.exercise.count({ where: { userId: user.id } })).toBe(1);
  });
});
