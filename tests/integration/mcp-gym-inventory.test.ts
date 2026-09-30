import { Buffer } from 'node:buffer';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { setOwnedGymEquipmentImage } from '@/lib/gym-equipment';
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

  it('keeps image tools and free-weight writes inside the owner boundary', async () => {
    const owner = await db.user.create({
      data: { email: 'mcp-inventory-owner@test.dev', passwordHash: 'x' },
    });
    const intruder = await db.user.create({
      data: { email: 'mcp-inventory-intruder@test.dev', passwordHash: 'x' },
    });
    const gym = await db.gym.create({
      data: { userId: owner.id, name: 'Owner gym', dumbbellWeights: [10, 20] },
    });
    const equipment = await db.gymEquipment.create({
      data: {
        gymId: gym.id,
        name: 'Owner press',
        equipmentType: 'MACHINE',
        imageData: new Uint8Array(PNG),
        imageMimeType: 'image/png',
      },
    });
    const client = await connect(intruder.id, true);

    const foreignImageRead = await client.callTool({
      name: 'get_gym_equipment_image',
      arguments: { equipmentId: equipment.id },
    });
    expect(foreignImageRead.isError).toBe(true);
    expect(JSON.stringify(foreignImageRead.content)).toContain('Gym equipment not found');
    expect(JSON.stringify(foreignImageRead.content)).not.toContain(PNG.toString('base64'));

    const foreignImageWrite = await client.callTool({
      name: 'set_gym_equipment_image',
      arguments: { confirmed: true, equipmentId: equipment.id, clear: true },
    });
    expect(foreignImageWrite.isError).toBe(true);
    expect(JSON.stringify(foreignImageWrite.content)).toContain('Gym equipment not found');

    const foreignWeights = await client.callTool({
      name: 'update_gym_free_weights',
      arguments: { confirmed: true, gymId: gym.id, dumbbellWeights: [99] },
    });
    expect(foreignWeights.isError).toBe(true);
    expect(JSON.stringify(foreignWeights.content)).toContain('Gym not found');

    expect(await db.gymEquipment.findUniqueOrThrow({ where: { id: equipment.id } })).toMatchObject({
      imageMimeType: 'image/png',
    });
    expect((await db.gym.findUniqueOrThrow({ where: { id: gym.id } })).dumbbellWeights).toEqual([
      10, 20,
    ]);
  });

  it('keeps a foreign equipment item out of an upsert addressed through a gym the caller owns', async () => {
    const owner = await db.user.create({
      data: { email: 'mcp-inventory-victim@test.dev', passwordHash: 'x' },
    });
    const caller = await db.user.create({
      data: { email: 'mcp-inventory-caller@test.dev', passwordHash: 'x' },
    });
    const ownerGym = await db.gym.create({ data: { userId: owner.id, name: 'Victim gym' } });
    const callerGym = await db.gym.create({ data: { userId: caller.id, name: 'Caller gym' } });
    const foreign = await db.gymEquipment.create({
      data: {
        gymId: ownerGym.id,
        name: 'Victim leg press',
        equipmentType: 'MACHINE',
        description: 'victim-only description',
        manufacturer: 'VictimCo',
        weightOptions: [40, 60],
      },
    });
    const client = await connect(caller.id, true);

    // The gym is the caller's own, so the gym ownership check passes; only the
    // equipment lookup scoped to that gym keeps the foreign row out of `previous`.
    const upsert = await client.callTool({
      name: 'upsert_gym_equipment',
      arguments: {
        confirmed: true,
        gymId: callerGym.id,
        equipmentId: foreign.id,
        name: 'Hijacked',
        equipmentType: 'MACHINE',
        weightOptions: [5],
      },
    });
    expect(upsert.isError).toBe(true);
    const text = JSON.stringify(upsert);
    expect(text).toContain('Gym equipment not found');
    expect(text).not.toContain('previous');
    expect(text).not.toContain('Victim leg press');
    expect(text).not.toContain('victim-only description');
    expect(text).not.toContain('VictimCo');

    expect(await db.gymEquipment.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({
      gymId: ownerGym.id,
      name: 'Victim leg press',
      description: 'victim-only description',
      manufacturer: 'VictimCo',
      weightOptions: [40, 60],
    });
    expect(await db.gymEquipment.count({ where: { gymId: callerGym.id } })).toBe(0);
  });

  it('rejects an empty image upload with a clean error, at the tool schema and in the helper', async () => {
    const user = await db.user.create({
      data: { email: 'mcp-inventory-empty-image@test.dev', passwordHash: 'x' },
    });
    const gym = await db.gym.create({ data: { userId: user.id, name: 'Empty image gym' } });
    const equipment = await db.gymEquipment.create({
      data: {
        gymId: gym.id,
        name: 'Pictured press',
        equipmentType: 'MACHINE',
        imageData: new Uint8Array(PNG),
        imageMimeType: 'image/png',
      },
    });
    const expectImageKept = async () => {
      const row = await db.gymEquipment.findUniqueOrThrow({ where: { id: equipment.id } });
      expect(row.imageMimeType).toBe('image/png');
      expect(Buffer.from(row.imageData ?? []).equals(PNG)).toBe(true);
    };
    const client = await connect(user.id, true);

    // An empty string used to pass the schema and the one-mode check, then crash
    // on a null decode and surface the raw TypeError text to the client.
    const empty = await client.callTool({
      name: 'set_gym_equipment_image',
      arguments: {
        confirmed: true,
        equipmentId: equipment.id,
        imageBase64: '',
        mimeType: 'image/png',
      },
    });
    expect(empty.isError).toBe(true);
    expect(JSON.stringify(empty.content)).toContain('imageBase64');
    expect(JSON.stringify(empty.content)).not.toContain('Cannot read properties');
    await expectImageKept();

    // Whitespace passes the schema and is refused by the decoder.
    const blank = await client.callTool({
      name: 'set_gym_equipment_image',
      arguments: {
        confirmed: true,
        equipmentId: equipment.id,
        imageBase64: '   ',
        mimeType: 'image/png',
      },
    });
    expect(blank.isError).toBe(true);
    expect(JSON.stringify(blank.content)).toContain('Uploaded equipment image is empty.');
    await expectImageKept();

    // The helper is also the REST path: an empty upload is a 400 there too, not a
    // null dereference.
    await expect(
      setOwnedGymEquipmentImage(user.id, equipment.id, { imageBase64: '', mimeType: 'image/png' }),
    ).rejects.toMatchObject({ status: 400, message: 'Uploaded equipment image is empty.' });
    await expectImageKept();
  });

  it('refuses every gym write on a read-only token and without the confirmed literal', async () => {
    const user = await db.user.create({
      data: { email: 'mcp-inventory-gates@test.dev', passwordHash: 'x' },
    });
    const gym = await db.gym.create({
      data: { userId: user.id, name: 'Gated gym', dumbbellWeights: [10, 20] },
    });
    const equipment = await db.gymEquipment.create({
      data: {
        gymId: gym.id,
        name: 'Gated press',
        equipmentType: 'MACHINE',
        imageData: new Uint8Array(PNG),
        imageMimeType: 'image/png',
      },
    });
    const writes = [
      { name: 'update_gym_free_weights', arguments: { gymId: gym.id, dumbbellWeights: [99] } },
      {
        name: 'upsert_gym_equipment',
        arguments: { gymId: gym.id, name: 'New machine', equipmentType: 'MACHINE' },
      },
      { name: 'set_gym_equipment_image', arguments: { equipmentId: equipment.id, clear: true } },
    ];
    const expectUnchanged = async () => {
      expect((await db.gym.findUniqueOrThrow({ where: { id: gym.id } })).dumbbellWeights).toEqual([
        10, 20,
      ]);
      expect(await db.gymEquipment.count({ where: { gymId: gym.id } })).toBe(1);
      expect(
        await db.gymEquipment.findUniqueOrThrow({ where: { id: equipment.id } }),
      ).toMatchObject({ imageMimeType: 'image/png' });
    };

    const readOnly = await connect(user.id, false);
    for (const write of writes) {
      const denied = await readOnly.callTool({
        name: write.name,
        arguments: { confirmed: true, ...write.arguments },
      });
      expect(denied.isError, write.name).toBe(true);
      expect(JSON.stringify(denied.content), write.name).toContain('read-only');
    }
    await expectUnchanged();

    // confirmed is the literal true, not a boolean: false and a missing value are
    // both rejected by the tool schema before the handler runs.
    const writable = await connect(user.id, true);
    for (const write of writes) {
      for (const confirmation of [{ confirmed: false }, {}]) {
        const unconfirmed = await writable.callTool({
          name: write.name,
          arguments: { ...confirmation, ...write.arguments },
        });
        expect(unconfirmed.isError, write.name).toBe(true);
        expect(JSON.stringify(unconfirmed.content), write.name).toContain('confirmed');
      }
    }
    await expectUnchanged();
  });

  it('accepts legacy non-cuid ids for gyms, equipment and exercises, like the REST routes', async () => {
    const user = await db.user.create({
      data: { email: 'mcp-inventory-legacy@test.dev', passwordHash: 'x' },
    });
    const gym = await db.gym.create({
      data: { id: 'gym_legacy_ids', userId: user.id, name: 'Legacy gym' },
    });
    const exercise = await db.exercise.create({
      data: {
        id: 'exercise_legacy_row',
        userId: user.id,
        name: 'Seated Row',
        muscleGroup: 'BACK_THICKNESS',
        category: 'COMPOUND',
        equipmentType: 'MACHINE',
      },
    });
    const equipment = await db.gymEquipment.create({
      data: { id: 'equipment_legacy_row', gymId: gym.id, name: 'Row', equipmentType: 'MACHINE' },
    });
    const client = await connect(user.id, true);

    const updated = await client.callTool({
      name: 'upsert_gym_equipment',
      arguments: {
        confirmed: true,
        gymId: gym.id,
        equipmentId: equipment.id,
        name: 'Row',
        equipmentType: 'MACHINE',
        exerciseIds: [exercise.id],
      },
    });
    expect(updated.isError).not.toBe(true);
    expect(await db.gymEquipmentExercise.count({ where: { equipmentId: equipment.id } })).toBe(1);

    // Reaches the owned-equipment lookup instead of failing id validation.
    const image = await client.callTool({
      name: 'get_gym_equipment_image',
      arguments: { equipmentId: equipment.id },
    });
    expect(JSON.stringify(image.content)).toContain('Gym equipment image not found');
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

    // An overwrite reports what it replaced, so the client can show or restore it.
    const reweighted = await client.callTool({
      name: 'update_gym_free_weights',
      arguments: { confirmed: true, gymId: gym.id, dumbbellWeights: [12, 14] },
    });
    expect(reweighted.structuredContent).toMatchObject({
      gym: { dumbbellWeights: [12, 14], plateWeights: [1.25, 2.5, 20], barWeights: [20] },
      previous: {
        dumbbellWeights: [10, 15.5, 19],
        plateWeights: [1.25, 2.5, 20],
        barWeights: [20],
      },
    });

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
    expect(upserted.structuredContent).toMatchObject({ created: true, previous: null });
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
    expect(updatedStack.structuredContent).toMatchObject({
      created: false,
      previous: {
        id: savedEquipment.id,
        name: 'Seated chest press',
        equipmentType: 'MACHINE',
        manufacturer: 'GymCo',
        weightOptions: [10, 20, 30, 40],
        exerciseIds: [exercise.id],
      },
    });
    expect(
      await db.gymExerciseConfig.findUniqueOrThrow({
        where: { gymId_exerciseId: { gymId: gym.id, exerciseId: exercise.id } },
      }),
    ).toMatchObject({ isAvailable: true, weightOptions: [15, 25, 35, 45] });
    expect(await db.gymEquipmentExercise.count({ where: { equipmentId: savedEquipment.id } })).toBe(
      1,
    );

    // Renaming onto another item's name violates the per-gym unique name. The
    // client gets a clean conflict message, not the raw Prisma error text.
    const other = await db.gymEquipment.create({
      data: { gymId: gym.id, name: 'Leg press', equipmentType: 'MACHINE' },
    });
    const renamed = await client.callTool({
      name: 'upsert_gym_equipment',
      arguments: {
        confirmed: true,
        gymId: gym.id,
        equipmentId: other.id,
        name: savedEquipment.name,
        equipmentType: 'MACHINE',
      },
    });
    expect(renamed.isError).toBe(true);
    const renamedText = JSON.stringify(renamed.content);
    expect(renamedText).toContain('Conflict: an entry with this value already exists.');
    expect(renamedText).not.toMatch(/prisma|invocation|constraint/i);
    expect((await db.gymEquipment.findUniqueOrThrow({ where: { id: other.id } })).name).toBe(
      'Leg press',
    );
    await db.gymEquipment.delete({ where: { id: other.id } });

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
    // The uploaded image is described without the cookie-only web URL: an MCP
    // client cannot fetch it and is pointed at the read tool instead.
    const uploadedImage = (uploaded.structuredContent as { equipment: { image: unknown } })
      .equipment.image;
    expect(uploadedImage).toMatchObject({
      kind: 'uploaded',
      mimeType: 'image/png',
      readWith: 'get_gym_equipment_image',
    });
    expect(uploadedImage).not.toHaveProperty('url');

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
          image: { kind: string; mimeType: string; url?: string } | null;
          exerciseLinks: Array<{ id: string }>;
        }>;
      };
    };
    expect(inventoryData.gym.equipment).toEqual([
      expect.objectContaining({
        id: savedEquipment.id,
        description: 'Plate-loaded converging chest press with an adjustable seat.',
        image: expect.objectContaining({
          kind: 'uploaded',
          mimeType: 'image/png',
          readWith: 'get_gym_equipment_image',
        }),
        exerciseLinks: [expect.objectContaining({ id: exercise.id })],
      }),
    ]);
    expect(inventoryData.gym.equipment[0]?.image).not.toHaveProperty('url');
    // Per-exercise coverage is unbounded, so it is opt-in.
    expect(inventoryData.gym).not.toHaveProperty('exerciseCoverage');

    const withCoverage = await client.callTool({
      name: 'get_gym_inventory',
      arguments: { gymId: gym.id, includeExerciseCoverage: true },
    });
    expect(withCoverage.structuredContent).toMatchObject({
      gym: {
        exerciseCoverage: [
          {
            id: exercise.id,
            configured: true,
            isAvailable: true,
            weightOptionsKg: [15, 25, 35, 45],
            equipmentIds: [savedEquipment.id],
          },
        ],
      },
    });

    // External URLs are not an MCP input: the argument is dropped by the tool
    // schema, so the call has no image action and nothing is stored.
    const externalUrl = await client.callTool({
      name: 'set_gym_equipment_image',
      arguments: {
        confirmed: true,
        equipmentId: savedEquipment.id,
        imageUrl: 'https://images.example/press.png?leak=1',
      },
    });
    expect(externalUrl.isError).toBe(true);
    expect(JSON.stringify(externalUrl.content)).toContain('clear or imageBase64');
    expect(
      await db.gymEquipment.findUniqueOrThrow({ where: { id: savedEquipment.id } }),
    ).toMatchObject({ imageUrl: null, imageMimeType: 'image/png' });

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
