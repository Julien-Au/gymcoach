import { Buffer } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as listEquipment, POST as createEquipment } from '@/app/api/gyms/[id]/equipment/route';
import {
  DELETE as deleteEquipment,
  PUT as updateEquipment,
} from '@/app/api/gym-equipment/[id]/route';
import {
  DELETE as deleteImage,
  GET as getImage,
  PUT as setImage,
} from '@/app/api/gym-equipment/[id]/image/route';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function request(url: string, method = 'GET', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function seedUser(label: string) {
  const user = await db.user.create({
    data: { email: `equipment-${label}-${Date.now()}@test.dev`, passwordHash: 'unused' },
  });
  const gym = await db.gym.create({ data: { userId: user.id, name: `${label} gym` } });
  return { user, gym };
}

beforeEach(() => mockUserId.mockReset());

describe('gym equipment REST API', () => {
  it('manages a physical station, exercise links, compatibility config, and image', async () => {
    const { user, gym } = await seedUser('owner');
    const exercise = await db.exercise.create({
      data: {
        userId: user.id,
        name: 'Cable row',
        muscleGroup: 'BACK_THICKNESS',
        category: 'COMPOUND',
        equipmentType: 'CABLE',
      },
    });
    mockUserId.mockResolvedValue(user.id);

    const createdResponse = await createEquipment(
      request(`http://test.local/api/gyms/${gym.id}/equipment`, 'POST', {
        name: 'Dual cable station',
        equipmentType: 'CABLE',
        description: 'Two adjustable pulleys',
        manufacturer: 'GymCo',
        modelName: 'DC-2',
        quantity: 2,
        weightOptions: [20, 10, 20],
        exerciseIds: [exercise.id],
      }),
      params(gym.id),
    );
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    const equipmentId = created.equipment.id as string;
    expect(created.equipment).toMatchObject({
      name: 'Dual cable station',
      equipmentType: 'CABLE',
      quantity: 2,
      weightOptions: [10, 20],
    });

    const link = await db.gymEquipmentExercise.findUnique({
      where: { equipmentId_exerciseId: { equipmentId, exerciseId: exercise.id } },
    });
    expect(link).not.toBeNull();
    const compatibility = await db.gymExerciseConfig.findUnique({
      where: { gymId_exerciseId: { gymId: gym.id, exerciseId: exercise.id } },
    });
    expect(compatibility).toMatchObject({ isAvailable: true, weightOptions: [10, 20] });

    const listedResponse = await listEquipment(
      request(`http://test.local/api/gyms/${gym.id}/equipment`),
      params(gym.id),
    );
    expect(listedResponse.status).toBe(200);
    const listed = await listedResponse.json();
    expect(listed.equipment).toHaveLength(1);
    expect(listed.equipment[0].exerciseLinks).toEqual([
      expect.objectContaining({ id: exercise.id, name: 'Cable row' }),
    ]);

    const updatedResponse = await updateEquipment(
      request(`http://test.local/api/gym-equipment/${equipmentId}`, 'PUT', {
        name: 'Cable station A',
        equipmentType: 'CABLE',
        quantity: 1,
        weightOptions: [5, 10, 15, 20],
        exerciseIds: [exercise.id],
      }),
      params(equipmentId),
    );
    expect(updatedResponse.status).toBe(200);
    expect((await updatedResponse.json()).equipment.name).toBe('Cable station A');

    const renamedViaCollection = await createEquipment(
      request('http://test.local/api/gyms/' + gym.id + '/equipment', 'POST', {
        equipmentId,
        name: 'Cable station renamed',
        equipmentType: 'CABLE',
        quantity: 1,
        weightOptions: [5, 10, 15, 20],
        exerciseIds: [exercise.id],
      }),
      params(gym.id),
    );
    expect(renamedViaCollection.status).toBe(200);
    const renamed = await renamedViaCollection.json();
    expect(renamed.equipment).toMatchObject({ id: equipmentId, name: 'Cable station renamed' });
    expect(await db.gymEquipment.count({ where: { gymId: gym.id } })).toBe(1);

    const imageResponse = await setImage(
      request(`http://test.local/api/gym-equipment/${equipmentId}/image`, 'PUT', {
        imageBase64: PNG.toString('base64'),
        mimeType: 'image/png',
      }),
      params(equipmentId),
    );
    expect(imageResponse.status).toBe(200);
    const fetchedImage = await getImage(
      request(`http://test.local/api/gym-equipment/${equipmentId}/image`),
      params(equipmentId),
    );
    expect(fetchedImage.status).toBe(200);
    expect(fetchedImage.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await fetchedImage.arrayBuffer())).toEqual(PNG);

    const listedWithImage = await listEquipment(
      request('http://attacker.invalid/api/gyms/' + gym.id + '/equipment'),
      params(gym.id),
    );
    const listedImage = (await listedWithImage.json()).equipment[0].image;
    expect(listedImage.url.startsWith(`/api/gym-equipment/${equipmentId}/image?v=`)).toBe(true);
    expect(listedImage.url).not.toContain('attacker.invalid');

    const clearResponse = await deleteImage(
      request(`http://test.local/api/gym-equipment/${equipmentId}/image`, 'DELETE'),
      params(equipmentId),
    );
    expect(clearResponse.status).toBe(200);
    expect(
      await db.gymEquipment.findUnique({ where: { id: equipmentId }, select: { imageData: true } }),
    ).toEqual({ imageData: null });

    const deletedResponse = await deleteEquipment(
      request(`http://test.local/api/gym-equipment/${equipmentId}`, 'DELETE'),
      params(equipmentId),
    );
    expect(deletedResponse.status).toBe(200);
    expect(await db.gymEquipment.count({ where: { id: equipmentId } })).toBe(0);
  });

  it('rejects an invalid gym route id before the domain query', async () => {
    const { user } = await seedUser('invalid-route-id');
    mockUserId.mockResolvedValue(user.id);

    const response = await listEquipment(
      request('http://test.local/api/gyms/%20/equipment'),
      params('   '),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid gym id.' });
  });

  it('enforces the per-gym equipment cap atomically across concurrent creates', async () => {
    const { user, gym } = await seedUser('capacity-race');
    mockUserId.mockResolvedValue(user.id);

    await db.gymEquipment.createMany({
      data: Array.from({ length: 999 }, (_, index) => ({
        gymId: gym.id,
        name: `Existing station ${index}`,
        equipmentType: 'MACHINE' as const,
      })),
    });

    const create = (name: string) =>
      createEquipment(
        request(`http://test.local/api/gyms/${gym.id}/equipment`, 'POST', {
          name,
          equipmentType: 'MACHINE',
        }),
        params(gym.id),
      );

    const responses = await Promise.all([create('Race station A'), create('Race station B')]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
    expect(await db.gymEquipment.count({ where: { gymId: gym.id } })).toBe(1000);
  });

  it('does not expose another user gym or accept another user exercise link', async () => {
    const owner = await seedUser('private-owner');
    const other = await seedUser('other');
    const otherExercise = await db.exercise.create({
      data: {
        userId: other.user.id,
        name: 'Other machine exercise',
        muscleGroup: 'QUADS',
        category: 'COMPOUND',
        equipmentType: 'MACHINE',
      },
    });

    mockUserId.mockResolvedValue(owner.user.id);
    const foreignLinkResponse = await createEquipment(
      request(`http://test.local/api/gyms/${owner.gym.id}/equipment`, 'POST', {
        name: 'Private station',
        equipmentType: 'MACHINE',
        exerciseIds: [otherExercise.id],
      }),
      params(owner.gym.id),
    );
    expect(foreignLinkResponse.status).toBe(400);
    expect(await db.gymEquipment.count({ where: { gymId: owner.gym.id } })).toBe(0);

    const privateEquipment = await db.gymEquipment.create({
      data: {
        gymId: owner.gym.id,
        name: 'Owner-only station',
        equipmentType: 'MACHINE',
        imageData: PNG,
        imageMimeType: 'image/png',
      },
    });

    mockUserId.mockResolvedValue(other.user.id);
    const foreignGymResponse = await listEquipment(
      request(`http://test.local/api/gyms/${owner.gym.id}/equipment`),
      params(owner.gym.id),
    );
    expect(foreignGymResponse.status).toBe(404);

    const foreignUpdateResponse = await updateEquipment(
      request(`http://test.local/api/gym-equipment/${privateEquipment.id}`, 'PUT', {
        name: 'Hacked station',
        equipmentType: 'MACHINE',
      }),
      params(privateEquipment.id),
    );
    expect(foreignUpdateResponse.status).toBe(404);

    const foreignDeleteResponse = await deleteEquipment(
      request(`http://test.local/api/gym-equipment/${privateEquipment.id}`, 'DELETE'),
      params(privateEquipment.id),
    );
    expect(foreignDeleteResponse.status).toBe(404);

    const foreignGetImageResponse = await getImage(
      request(`http://test.local/api/gym-equipment/${privateEquipment.id}/image`),
      params(privateEquipment.id),
    );
    expect(foreignGetImageResponse.status).toBe(404);

    const foreignSetImageResponse = await setImage(
      request(`http://test.local/api/gym-equipment/${privateEquipment.id}/image`, 'PUT', {
        imageBase64: PNG.toString('base64'),
        mimeType: 'image/png',
      }),
      params(privateEquipment.id),
    );
    expect(foreignSetImageResponse.status).toBe(404);

    const foreignDeleteImageResponse = await deleteImage(
      request(`http://test.local/api/gym-equipment/${privateEquipment.id}/image`, 'DELETE'),
      params(privateEquipment.id),
    );
    expect(foreignDeleteImageResponse.status).toBe(404);

    const preserved = await db.gymEquipment.findUnique({ where: { id: privateEquipment.id } });
    expect(preserved?.name).toBe('Owner-only station');
    expect(preserved?.imageMimeType).toBe('image/png');
    expect(preserved?.imageData?.byteLength).toBe(PNG.byteLength);
  });
});
