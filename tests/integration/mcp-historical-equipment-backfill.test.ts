import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import {
  applyHistoricalEquipmentBackfill,
  undoHistoricalEquipmentBackfill,
} from '@/lib/mcp/historical-equipment-backfill';

async function seedBackfillCase(label: string) {
  const suffix = label + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const user = await db.user.create({
    data: { email: 'backfill-' + suffix + '@test.dev', passwordHash: 'unused' },
  });
  const gym = await db.gym.create({ data: { userId: user.id, name: 'Gym ' + suffix } });
  const exercise = await db.exercise.create({
    data: {
      userId: user.id,
      name: 'Cable row ' + suffix,
      muscleGroup: 'BACK_THICKNESS',
      category: 'COMPOUND',
      equipmentType: 'CABLE',
    },
  });
  const equipment = await db.gymEquipment.create({
    data: {
      gymId: gym.id,
      name: 'Cable stack ' + suffix,
      equipmentType: 'CABLE',
      weightOptions: [10, 20, 30],
      exerciseLinks: { create: { exerciseId: exercise.id } },
    },
  });
  const session = await db.session.create({ data: { userId: user.id, gymId: gym.id } });
  const sets = await Promise.all(
    [1, 2].map((setNumber) =>
      db.set.create({
        data: {
          sessionId: session.id,
          exerciseId: exercise.id,
          setNumber,
          weight: 20,
          reps: 10,
        },
      }),
    ),
  );
  return { user, gym, exercise, equipment, sets };
}

describe('historical equipment backfill transactions', () => {
  it('atomically applies an audited equipment snapshot and undoes it', async () => {
    const seeded = await seedBackfillCase('roundtrip');
    const setIds = seeded.sets.map((set) => set.id);

    const applied = await applyHistoricalEquipmentBackfill(seeded.user.id, {
      gymId: seeded.gym.id,
      exerciseId: seeded.exercise.id,
      equipmentId: seeded.equipment.id,
      setIds,
      confirmed: true,
    });

    expect(applied.appliedSetIds).toEqual(setIds);
    expect(
      await db.set.findMany({
        where: { id: { in: setIds } },
        orderBy: { setNumber: 'asc' },
        select: { gymEquipmentId: true, equipmentNameSnapshot: true, equipmentLoadSnapshot: true },
      }),
    ).toEqual([
      expect.objectContaining({
        gymEquipmentId: seeded.equipment.id,
        equipmentNameSnapshot: seeded.equipment.name,
      }),
      expect.objectContaining({
        gymEquipmentId: seeded.equipment.id,
        equipmentNameSnapshot: seeded.equipment.name,
      }),
    ]);
    expect(
      await db.mcpHistoricalEquipmentBackfillAudit.findUnique({ where: { id: applied.auditId } }),
    ).toMatchObject({ userId: seeded.user.id, setIds, undoneAt: null });

    await undoHistoricalEquipmentBackfill(seeded.user.id, {
      auditId: applied.auditId,
      confirmed: true,
    });

    expect(
      await db.set.findMany({
        where: { id: { in: setIds } },
        select: { gymEquipmentId: true, equipmentNameSnapshot: true, equipmentLoadSnapshot: true },
      }),
    ).toEqual([
      { gymEquipmentId: null, equipmentNameSnapshot: null, equipmentLoadSnapshot: null },
      { gymEquipmentId: null, equipmentNameSnapshot: null, equipmentLoadSnapshot: null },
    ]);
    expect(
      await db.mcpHistoricalEquipmentBackfillAudit.findUnique({ where: { id: applied.auditId } }),
    ).toEqual(expect.objectContaining({ undoneAt: expect.any(Date) }));
  });

  it('fails closed and rolls back the entire undo when one audited set changed later', async () => {
    const seeded = await seedBackfillCase('fail-closed');
    const setIds = seeded.sets.map((set) => set.id);
    const applied = await applyHistoricalEquipmentBackfill(seeded.user.id, {
      gymId: seeded.gym.id,
      exerciseId: seeded.exercise.id,
      equipmentId: seeded.equipment.id,
      setIds,
      confirmed: true,
    });

    await db.set.update({
      where: { id: setIds[0] },
      data: { equipmentNameSnapshot: seeded.equipment.name + ' changed later' },
    });

    await expect(
      undoHistoricalEquipmentBackfill(seeded.user.id, {
        auditId: applied.auditId,
        confirmed: true,
      }),
    ).rejects.toThrow('Undo aborted');

    const after = await db.set.findMany({
      where: { id: { in: setIds } },
      orderBy: { setNumber: 'asc' },
      select: { gymEquipmentId: true, equipmentNameSnapshot: true },
    });
    expect(after[0]).toEqual({
      gymEquipmentId: seeded.equipment.id,
      equipmentNameSnapshot: seeded.equipment.name + ' changed later',
    });
    expect(after[1]).toEqual({
      gymEquipmentId: seeded.equipment.id,
      equipmentNameSnapshot: seeded.equipment.name,
    });
    expect(
      await db.mcpHistoricalEquipmentBackfillAudit.findUnique({ where: { id: applied.auditId } }),
    ).toMatchObject({ undoneAt: null });
  });
});
