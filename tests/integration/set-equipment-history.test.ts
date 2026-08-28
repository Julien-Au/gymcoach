import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as createSet } from '@/app/api/sessions/[id]/sets/route';

function request(sessionId: string, body: unknown): Request {
  return new Request(`http://test.local/api/sessions/${sessionId}/sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function seed() {
  const user = await db.user.create({
    data: { email: `set-equipment-${Date.now()}@test.dev`, passwordHash: 'unused' },
  });
  const exercise = await db.exercise.create({
    data: {
      userId: user.id,
      name: 'Equipment history row',
      muscleGroup: 'BACK_THICKNESS',
      category: 'COMPOUND',
      equipmentType: 'CABLE',
    },
  });
  const gym = await db.gym.create({ data: { userId: user.id, name: 'Frozen gym' } });
  const otherGym = await db.gym.create({ data: { userId: user.id, name: 'Other gym' } });
  const equipment = await db.gymEquipment.create({
    data: {
      gymId: gym.id,
      name: 'Cable station original',
      equipmentType: 'CABLE',
      manufacturer: 'GymCo',
      modelName: 'Cable-1',
      weightOptions: [10, 20, 30],
      exerciseLinks: { create: { exerciseId: exercise.id } },
    },
  });
  const wrongGymEquipment = await db.gymEquipment.create({
    data: {
      gymId: otherGym.id,
      name: 'Cable station other gym',
      equipmentType: 'CABLE',
      weightOptions: [10, 20, 30],
      exerciseLinks: { create: { exerciseId: exercise.id } },
    },
  });
  const unlinked = await db.gymEquipment.create({
    data: {
      gymId: gym.id,
      name: 'Unlinked cable',
      equipmentType: 'CABLE',
      weightOptions: [5, 10],
    },
  });
  const session = await db.session.create({
    data: { userId: user.id, gymId: gym.id },
  });
  return { user, exercise, gym, equipment, wrongGymEquipment, unlinked, session };
}

beforeEach(() => mockUserId.mockReset());

describe('set equipment history', () => {
  it('freezes equipment facts on the set and keeps them after rename and deletion', async () => {
    const { user, exercise, equipment, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const response = await createSet(
      request(session.id, {
        exerciseId: exercise.id,
        gymEquipmentId: equipment.id,
        setNumber: 1,
        weight: 20,
        reps: 10,
        rir: 2,
      }),
      params(session.id),
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created).toMatchObject({
      gymEquipmentId: equipment.id,
      equipmentNameSnapshot: 'Cable station original',
      equipmentLoadSnapshot: {
        version: 1,
        equipmentType: 'CABLE',
        manufacturer: 'GymCo',
        modelName: 'Cable-1',
        weightOptions: [10, 20, 30],
      },
    });

    await db.gymEquipment.update({
      where: { id: equipment.id },
      data: { name: 'Renamed station' },
    });
    const afterRename = await db.set.findUniqueOrThrow({ where: { id: created.id } });
    expect(afterRename.gymEquipmentId).toBe(equipment.id);
    expect(afterRename.equipmentNameSnapshot).toBe('Cable station original');

    await db.gymEquipment.delete({ where: { id: equipment.id } });
    const afterDelete = await db.set.findUniqueOrThrow({ where: { id: created.id } });
    expect(afterDelete.gymEquipmentId).toBeNull();
    expect(afterDelete.equipmentNameSnapshot).toBe('Cable station original');
    expect(afterDelete.equipmentLoadSnapshot).toMatchObject({
      version: 1,
      equipmentType: 'CABLE',
      manufacturer: 'GymCo',
      modelName: 'Cable-1',
    });
  });

  it('drops stale optional equipment references and still records the training sets', async () => {
    const { user, exercise, equipment, wrongGymEquipment, unlinked, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const wrongGym = await createSet(
      request(session.id, {
        exerciseId: exercise.id,
        gymEquipmentId: wrongGymEquipment.id,
        setNumber: 1,
        weight: 20,
        reps: 10,
      }),
      params(session.id),
    );
    expect(wrongGym.status).toBe(201);
    const wrongGymSet = await wrongGym.json();
    expect(wrongGymSet).toMatchObject({
      gymEquipmentId: null,
      equipmentNameSnapshot: null,
      weight: 20,
      reps: 10,
    });
    const [nullState] = await db.$queryRaw<Array<{ isDbNull: boolean; isJsonNull: boolean }>>`
      SELECT
        "equipmentLoadSnapshot" IS NULL AS "isDbNull",
        "equipmentLoadSnapshot" = 'null'::jsonb AS "isJsonNull"
      FROM "Set"
      WHERE "id" = ${wrongGymSet.id}
    `;
    expect(nullState).toEqual({ isDbNull: false, isJsonNull: true });

    const notLinked = await createSet(
      request(session.id, {
        exerciseId: exercise.id,
        gymEquipmentId: unlinked.id,
        setNumber: 2,
        weight: 10,
        reps: 10,
      }),
      params(session.id),
    );
    expect(notLinked.status).toBe(201);
    expect(await notLinked.json()).toMatchObject({
      gymEquipmentId: null,
      equipmentNameSnapshot: null,
      weight: 10,
      reps: 10,
    });

    await db.gymEquipment.delete({ where: { id: equipment.id } });
    const deleted = await createSet(
      request(session.id, {
        exerciseId: exercise.id,
        gymEquipmentId: equipment.id,
        setNumber: 3,
        weight: 15,
        reps: 12,
        rir: 1,
      }),
      params(session.id),
    );
    expect(deleted.status).toBe(201);
    expect(await deleted.json()).toMatchObject({
      gymEquipmentId: null,
      equipmentNameSnapshot: null,
      weight: 15,
      reps: 12,
      rir: 1,
    });

    expect(await db.set.count({ where: { sessionId: session.id } })).toBe(3);
  });
});
