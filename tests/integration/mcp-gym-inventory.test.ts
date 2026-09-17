import { Buffer } from 'node:buffer';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createGymCoachMcpServer } from '@/lib/mcp/server';

const servers: Array<ReturnType<typeof createGymCoachMcpServer>> = [];
const clients: Client[] = [];
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function connect(userId: string, canWrite: boolean) {
  const server = createGymCoachMcpServer({
    principal: { tokenId: `token-${userId}`, userId, canWrite },
    baseUrl: 'https://gymcoach.example',
  });
  const client = new Client({ name: 'gym-inventory-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  servers.push(server);
  clients.push(client);
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
  await Promise.allSettled(servers.splice(0).map((server) => server.close()));
});

describe('GymCoach MCP gym inventory', () => {
  it('isolates gym reads by owner and rejects writes for a read-only principal', async () => {
    const userA = await db.user.create({
      data: { email: 'mcp-inventory-a@test.dev', passwordHash: 'x' },
    });
    const userB = await db.user.create({
      data: { email: 'mcp-inventory-b@test.dev', passwordHash: 'x' },
    });
    const gymA = await db.gym.create({
      data: { id: 'gym_legacy_olymp', userId: userA.id, name: 'Olymp' },
    });
    const gymB = await db.gym.create({ data: { userId: userB.id, name: 'Foreign gym' } });
    await db.user.update({ where: { id: userA.id }, data: { activeGymId: gymA.id } });

    const client = await connect(userA.id, false);
    const listed = await client.callTool({ name: 'list_gyms', arguments: {} });
    const listedData = listed.structuredContent as {
      activeGymId: string | null;
      gyms: Array<{ id: string; name: string }>;
    };
    expect(listedData.activeGymId).toBe(gymA.id);
    expect(listedData.gyms).toEqual([expect.objectContaining({ id: gymA.id, name: 'Olymp' })]);

    const foreignRead = await client.callTool({
      name: 'get_gym_inventory',
      arguments: { gymId: gymB.id },
    });
    expect(foreignRead.isError).toBe(true);
    expect(foreignRead.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('Gym not found') }),
    ]);

    const writeClient = await connect(userA.id, true);
    const foreignWrite = await writeClient.callTool({
      name: 'upsert_gym_equipment',
      arguments: {
        confirmed: true,
        gymId: gymB.id,
        name: 'Foreign machine',
        equipmentType: 'MACHINE',
      },
    });
    expect(foreignWrite.isError).toBe(true);
    expect(foreignWrite.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('Gym not found') }),
    ]);

    const deniedWrite = await client.callTool({
      name: 'update_gym_free_weights',
      arguments: { confirmed: true, gymId: gymA.id, dumbbellWeights: [10, 12] },
    });
    expect(deniedWrite.isError).toBe(true);
    expect(deniedWrite.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('read-only') }),
    ]);
    expect((await db.gym.findUniqueOrThrow({ where: { id: gymA.id } })).dumbbellWeights).toEqual(
      [],
    );
  });

  it('updates free weights, adds linked equipment and exchanges uploaded images', async () => {
    const user = await db.user.create({
      data: { email: 'mcp-inventory-write@test.dev', passwordHash: 'x' },
    });
    const exercise = await db.exercise.create({
      data: {
        userId: user.id,
        name: 'Chest Press',
        muscleGroup: 'CHEST',
        category: 'COMPOUND',
        equipmentType: 'MACHINE',
      },
    });
    const gym = await db.gym.create({ data: { userId: user.id, name: 'Olymp' } });
    await db.user.update({ where: { id: user.id }, data: { activeGymId: gym.id } });
    const client = await connect(user.id, true);

    const weights = await client.callTool({
      name: 'update_gym_free_weights',
      arguments: {
        confirmed: true,
        gymId: gym.id,
        dumbbellWeights: [19, 10, 15.5, 10],
        plateWeights: [20, 2.5, 1.25],
        barWeights: [20],
      },
    });
    expect(weights.isError).not.toBe(true);
    expect((await db.gym.findUniqueOrThrow({ where: { id: gym.id } })).dumbbellWeights).toEqual([
      10, 15.5, 19,
    ]);

    const upserted = await client.callTool({
      name: 'upsert_gym_equipment',
      arguments: {
        confirmed: true,
        gymId: gym.id,
        name: 'Seated chest press',
        equipmentType: 'MACHINE',
        description: 'Plate-loaded converging chest press with an adjustable seat.',
        manufacturer: 'GymCo',
        modelName: 'Press 2000',
        quantity: 1,
        weightOptions: [10, 20, 30, 40],
        exerciseIds: [exercise.id],
      },
    });
    expect(upserted.isError).not.toBe(true);
    const savedEquipment = await db.gymEquipment.findFirstOrThrow({
      where: { gymId: gym.id, name: 'Seated chest press' },
      include: { exerciseLinks: true },
    });
    expect(savedEquipment.exerciseLinks).toEqual([
      expect.objectContaining({ exerciseId: exercise.id }),
    ]);
    expect(
      await db.gymExerciseConfig.findUniqueOrThrow({
        where: { gymId_exerciseId: { gymId: gym.id, exerciseId: exercise.id } },
      }),
    ).toMatchObject({ isAvailable: true, weightOptions: [10, 20, 30, 40] });

    const updatedStack = await client.callTool({
      name: 'upsert_gym_equipment',
      arguments: {
        confirmed: true,
        gymId: gym.id,
        equipmentId: savedEquipment.id,
        name: savedEquipment.name,
        equipmentType: savedEquipment.equipmentType,
        weightOptions: [15, 25, 35, 45],
      },
    });
    expect(updatedStack.isError).not.toBe(true);
    expect(
      await db.gymExerciseConfig.findUniqueOrThrow({
        where: { gymId_exerciseId: { gymId: gym.id, exerciseId: exercise.id } },
      }),
    ).toMatchObject({ isAvailable: true, weightOptions: [15, 25, 35, 45] });
    expect(await db.gymEquipmentExercise.count({ where: { equipmentId: savedEquipment.id } })).toBe(
      1,
    );

    const uploaded = await client.callTool({
      name: 'set_gym_equipment_image',
      arguments: {
        confirmed: true,
        equipmentId: savedEquipment.id,
        imageBase64: PNG.toString('base64'),
        mimeType: 'image/png',
      },
    });
    expect(uploaded.isError).not.toBe(true);

    const fetched = await client.callTool({
      name: 'get_gym_equipment_image',
      arguments: { equipmentId: savedEquipment.id },
    });
    expect(fetched.isError).not.toBe(true);
    expect(fetched.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'image',
          data: PNG.toString('base64'),
          mimeType: 'image/png',
        }),
      ]),
    );

    const inventory = await client.callTool({
      name: 'get_gym_inventory',
      arguments: { gymId: gym.id },
    });
    const inventoryData = inventory.structuredContent as {
      gym: {
        equipment: Array<{
          id: string;
          description: string | null;
          image: { kind: string; mimeType: string } | null;
          exerciseLinks: Array<{ id: string }>;
        }>;
      };
    };
    expect(inventoryData.gym.equipment).toEqual([
      expect.objectContaining({
        id: savedEquipment.id,
        description: 'Plate-loaded converging chest press with an adjustable seat.',
        image: expect.objectContaining({ kind: 'uploaded', mimeType: 'image/png' }),
        exerciseLinks: [expect.objectContaining({ id: exercise.id })],
      }),
    ]);

    const cleared = await client.callTool({
      name: 'set_gym_equipment_image',
      arguments: { confirmed: true, equipmentId: savedEquipment.id, clear: true },
    });
    expect(cleared.isError).not.toBe(true);
    expect(
      await db.gymEquipment.findUniqueOrThrow({ where: { id: savedEquipment.id } }),
    ).toMatchObject({ imageUrl: null, imageData: null, imageMimeType: null });
  });
});
