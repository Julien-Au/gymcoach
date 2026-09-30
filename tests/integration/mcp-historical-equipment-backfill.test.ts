import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import {
  applyHistoricalEquipmentBackfill,
  listHistoricalEquipmentBackfills,
  previewHistoricalEquipmentBackfill,
  undoHistoricalEquipmentBackfill,
} from '@/lib/mcp/historical-equipment-backfill';
import { createGymCoachMcpServer } from '@/lib/mcp/server';

const openServers: Array<ReturnType<typeof createGymCoachMcpServer>> = [];
const openClients: Client[] = [];

afterEach(async () => {
  await Promise.allSettled(openClients.splice(0).map((client) => client.close()));
  await Promise.allSettled(openServers.splice(0).map((server) => server.close()));
});

async function connect(userId: string, canWrite = true) {
  const server = createGymCoachMcpServer({
    principal: { tokenId: `token-${userId}`, userId, canWrite },
    baseUrl: 'https://gymcoach.example',
  });
  const client = new Client({ name: 'gymcoach-test', version: '1.0.0' });
  openServers.push(server);
  openClients.push(client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

const UNASSIGNED = {
  gymEquipmentId: null,
  equipmentNameSnapshot: null,
  equipmentLoadSnapshot: null,
};

async function setEquipmentState(setIds: string[]) {
  return db.set.findMany({
    where: { id: { in: setIds } },
    orderBy: { setNumber: 'asc' },
    select: { gymEquipmentId: true, equipmentNameSnapshot: true, equipmentLoadSnapshot: true },
  });
}

async function seedBackfillCase(
  label: string,
  options: { gymId?: string; sessionInProgress?: boolean } = {},
) {
  const suffix = label + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const user = await db.user.create({
    data: { email: 'backfill-' + suffix + '@test.dev', passwordHash: 'unused' },
  });
  const gym = await db.gym.create({
    data: {
      ...(options.gymId ? { id: options.gymId } : {}),
      userId: user.id,
      name: 'Gym ' + suffix,
    },
  });
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
  // Backfill only touches historical sets, so the seeded session is finished
  // unless a test asks for one that is still in progress.
  const session = await db.session.create({
    data: {
      userId: user.id,
      gymId: gym.id,
      finishedAt: options.sessionInProgress ? null : new Date(),
    },
  });
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
  const [firstSetId, secondSetId] = sets.map((set) => set.id);
  if (!firstSetId || !secondSetId) throw new Error('Seed must create two sets.');
  return { user, gym, exercise, equipment, session, sets, firstSetId, secondSetId };
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
        equipmentLoadSnapshot: {
          version: 1,
          equipmentType: 'CABLE',
          manufacturer: null,
          modelName: null,
          weightOptions: [10, 20, 30],
        },
      }),
      expect.objectContaining({
        gymEquipmentId: seeded.equipment.id,
        equipmentNameSnapshot: seeded.equipment.name,
        equipmentLoadSnapshot: {
          version: 1,
          equipmentType: 'CABLE',
          manufacturer: null,
          modelName: null,
          weightOptions: [10, 20, 30],
        },
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

  it("rejects an apply that targets another user's sets and leaves everything untouched", async () => {
    const victim = await seedBackfillCase('victim');
    const attacker = await seedBackfillCase('attacker');
    const victimSetIds = victim.sets.map((set) => set.id);

    // With the attacker's own, fully valid gym/exercise/equipment mapping.
    await expect(
      applyHistoricalEquipmentBackfill(attacker.user.id, {
        gymId: attacker.gym.id,
        exerciseId: attacker.exercise.id,
        equipmentId: attacker.equipment.id,
        setIds: victimSetIds,
        confirmed: true,
      }),
    ).rejects.toThrow('Backfill aborted');
    // With the victim's own IDs passed by the attacker.
    await expect(
      applyHistoricalEquipmentBackfill(attacker.user.id, {
        gymId: victim.gym.id,
        exerciseId: victim.exercise.id,
        equipmentId: victim.equipment.id,
        setIds: victimSetIds,
        confirmed: true,
      }),
    ).rejects.toThrow('Equipment mapping is not owned');

    expect(await setEquipmentState(victimSetIds)).toEqual([UNASSIGNED, UNASSIGNED]);
    expect(await db.mcpHistoricalEquipmentBackfillAudit.count()).toBe(0);
  });

  it("rejects an undo of another user's audit and leaves the backfill in place", async () => {
    const victim = await seedBackfillCase('undo-victim');
    const attacker = await seedBackfillCase('undo-attacker');
    const setIds = victim.sets.map((set) => set.id);
    const applied = await applyHistoricalEquipmentBackfill(victim.user.id, {
      gymId: victim.gym.id,
      exerciseId: victim.exercise.id,
      equipmentId: victim.equipment.id,
      setIds,
      confirmed: true,
    });

    await expect(
      undoHistoricalEquipmentBackfill(attacker.user.id, {
        auditId: applied.auditId,
        confirmed: true,
      }),
    ).rejects.toThrow('audit not found');

    const after = await setEquipmentState(setIds);
    expect(after.map((set) => set.gymEquipmentId)).toEqual([
      victim.equipment.id,
      victim.equipment.id,
    ]);
    expect(
      await db.mcpHistoricalEquipmentBackfillAudit.findUnique({ where: { id: applied.auditId } }),
    ).toMatchObject({ userId: victim.user.id, undoneAt: null });
  });

  it('rejects equipment that is foreign, not linked to the exercise, or in another gym', async () => {
    const seeded = await seedBackfillCase('equipment');
    const other = await seedBackfillCase('equipment-other');
    const setIds = seeded.sets.map((set) => set.id);
    const unlinked = await db.gymEquipment.create({
      data: { gymId: seeded.gym.id, name: 'Unlinked press', equipmentType: 'MACHINE' },
    });
    const secondGym = await db.gym.create({
      data: { userId: seeded.user.id, name: 'Second gym' },
    });
    const wrongGym = await db.gymEquipment.create({
      data: {
        gymId: secondGym.id,
        name: 'Cable stack elsewhere',
        equipmentType: 'CABLE',
        exerciseLinks: { create: { exerciseId: seeded.exercise.id } },
      },
    });

    for (const equipmentId of [other.equipment.id, unlinked.id, wrongGym.id]) {
      await expect(
        applyHistoricalEquipmentBackfill(seeded.user.id, {
          gymId: seeded.gym.id,
          exerciseId: seeded.exercise.id,
          equipmentId,
          setIds,
          confirmed: true,
        }),
      ).rejects.toThrow('Equipment mapping is not owned');
    }

    expect(await setEquipmentState(setIds)).toEqual([UNASSIGNED, UNASSIGNED]);
    expect(await db.mcpHistoricalEquipmentBackfillAudit.count()).toBe(0);
  });

  it('aborts the whole apply when one requested set already has an assignment', async () => {
    const seeded = await seedBackfillCase('no-overwrite');
    const setIds = seeded.sets.map((set) => set.id);
    const earlier = await db.gymEquipment.create({
      data: {
        gymId: seeded.gym.id,
        name: 'Earlier cable stack',
        equipmentType: 'CABLE',
        exerciseLinks: { create: { exerciseId: seeded.exercise.id } },
      },
    });
    await db.set.update({
      where: { id: seeded.firstSetId },
      data: { gymEquipmentId: earlier.id, equipmentNameSnapshot: earlier.name },
    });

    await expect(
      applyHistoricalEquipmentBackfill(seeded.user.id, {
        gymId: seeded.gym.id,
        exerciseId: seeded.exercise.id,
        equipmentId: seeded.equipment.id,
        setIds,
        confirmed: true,
      }),
    ).rejects.toThrow('Backfill aborted');

    expect(await setEquipmentState(setIds)).toEqual([
      {
        gymEquipmentId: earlier.id,
        equipmentNameSnapshot: earlier.name,
        equipmentLoadSnapshot: null,
      },
      UNASSIGNED,
    ]);
    expect(await db.mcpHistoricalEquipmentBackfillAudit.count()).toBe(0);
  });

  it('refuses to undo the same audit twice', async () => {
    const seeded = await seedBackfillCase('double-undo');
    const setIds = seeded.sets.map((set) => set.id);
    const applied = await applyHistoricalEquipmentBackfill(seeded.user.id, {
      gymId: seeded.gym.id,
      exerciseId: seeded.exercise.id,
      equipmentId: seeded.equipment.id,
      setIds,
      confirmed: true,
    });
    const undo = { auditId: applied.auditId, confirmed: true };
    await undoHistoricalEquipmentBackfill(seeded.user.id, undo);
    const firstUndo = await db.mcpHistoricalEquipmentBackfillAudit.findUniqueOrThrow({
      where: { id: applied.auditId },
    });

    await expect(undoHistoricalEquipmentBackfill(seeded.user.id, undo)).rejects.toThrow(
      'already undone',
    );

    expect(await setEquipmentState(setIds)).toEqual([UNASSIGNED, UNASSIGNED]);
    expect(
      await db.mcpHistoricalEquipmentBackfillAudit.findUnique({ where: { id: applied.auditId } }),
    ).toMatchObject({ undoneAt: firstUndo.undoneAt });
  });

  it('leaves the sets of a session still in progress out of preview and apply', async () => {
    const seeded = await seedBackfillCase('in-progress', { sessionInProgress: true });
    const setIds = seeded.sets.map((set) => set.id);

    const preview = await previewHistoricalEquipmentBackfill(seeded.user.id, {});
    expect(preview.returnedMissingSets).toBe(0);

    await expect(
      applyHistoricalEquipmentBackfill(seeded.user.id, {
        gymId: seeded.gym.id,
        exerciseId: seeded.exercise.id,
        equipmentId: seeded.equipment.id,
        setIds,
        confirmed: true,
      }),
    ).rejects.toThrow('Backfill aborted');
    expect(await setEquipmentState(setIds)).toEqual([UNASSIGNED, UNASSIGNED]);
    expect(await db.mcpHistoricalEquipmentBackfillAudit.count()).toBe(0);

    // Once the session is finished the same sets become historical.
    await db.session.update({ where: { id: seeded.session.id }, data: { finishedAt: new Date() } });
    const finished = await previewHistoricalEquipmentBackfill(seeded.user.id, {});
    expect(finished.groups[0]?.missingSetIds.sort()).toEqual([...setIds].sort());
  });
});

describe('historical equipment backfill preview and audit listing', () => {
  it('does not count a set from a session still in progress as prior-use evidence', async () => {
    const seeded = await seedBackfillCase('evidence');
    // A second machine for the same exercise: with two candidates the
    // suggestion can only come from assigned history.
    const other = await db.gymEquipment.create({
      data: {
        gymId: seeded.gym.id,
        name: 'Second cable stack',
        equipmentType: 'CABLE',
        weightOptions: [10, 20, 30],
        exerciseLinks: { create: { exerciseId: seeded.exercise.id } },
      },
    });
    const live = await db.session.create({
      data: { userId: seeded.user.id, gymId: seeded.gym.id, finishedAt: null },
    });
    await db.set.create({
      data: {
        sessionId: live.id,
        exerciseId: seeded.exercise.id,
        setNumber: 1,
        weight: 20,
        reps: 10,
        gymEquipmentId: other.id,
        equipmentNameSnapshot: other.name,
      },
    });
    const evidenceFor = async () => {
      const preview = await previewHistoricalEquipmentBackfill(seeded.user.id, {});
      const group = preview.groups[0];
      return {
        suggested: group?.suggestedEquipment?.equipmentId ?? null,
        count:
          group?.candidateEquipment.find((item) => item.equipmentId === other.id)
            ?.assignedHistoricalSetCount ?? null,
      };
    };

    expect(await evidenceFor()).toEqual({ suggested: null, count: 0 });

    // Once that session is finished its set is history and backs a suggestion.
    await db.session.update({ where: { id: live.id }, data: { finishedAt: new Date() } });
    expect(await evidenceFor()).toEqual({ suggested: other.id, count: 1 });
  });

  it("previews only the caller's own missing sets and equipment candidates", async () => {
    const caller = await seedBackfillCase('preview-caller');
    const other = await seedBackfillCase('preview-other');

    const preview = await previewHistoricalEquipmentBackfill(caller.user.id, {});

    expect(preview.returnedMissingSets).toBe(2);
    expect(preview.groups).toHaveLength(1);
    expect(preview.groups[0]?.missingSetIds.sort()).toEqual(
      caller.sets.map((set) => set.id).sort(),
    );
    expect(preview.groups[0]?.candidateEquipment.map((item) => item.equipmentId)).toEqual([
      caller.equipment.id,
    ]);
    // Filtering on another user's gym or exercise finds nothing either.
    expect(
      (await previewHistoricalEquipmentBackfill(caller.user.id, { gymId: other.gym.id }))
        .returnedMissingSets,
    ).toBe(0);
    expect(
      (await previewHistoricalEquipmentBackfill(caller.user.id, { exerciseId: other.exercise.id }))
        .returnedMissingSets,
    ).toBe(0);
  });

  it("lists only the caller's audits, newest first, without the set ID arrays", async () => {
    const caller = await seedBackfillCase('list-caller');
    const other = await seedBackfillCase('list-other');
    const first = await applyHistoricalEquipmentBackfill(caller.user.id, {
      gymId: caller.gym.id,
      exerciseId: caller.exercise.id,
      equipmentId: caller.equipment.id,
      setIds: [caller.firstSetId],
      confirmed: true,
    });
    const second = await applyHistoricalEquipmentBackfill(caller.user.id, {
      gymId: caller.gym.id,
      exerciseId: caller.exercise.id,
      equipmentId: caller.equipment.id,
      setIds: [caller.secondSetId],
      confirmed: true,
    });
    await db.mcpHistoricalEquipmentBackfillAudit.update({
      where: { id: first.auditId },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });
    await applyHistoricalEquipmentBackfill(other.user.id, {
      gymId: other.gym.id,
      exerciseId: other.exercise.id,
      equipmentId: other.equipment.id,
      setIds: other.sets.map((set) => set.id),
      confirmed: true,
    });
    await undoHistoricalEquipmentBackfill(caller.user.id, {
      auditId: first.auditId,
      confirmed: true,
    });

    const listed = await listHistoricalEquipmentBackfills(caller.user.id);

    expect(listed.backfills.map((audit) => audit.auditId)).toEqual([second.auditId, first.auditId]);
    expect(listed.backfills[0]).toEqual({
      auditId: second.auditId,
      createdAt: expect.any(Date),
      undoneAt: null,
      gymId: caller.gym.id,
      exerciseId: caller.exercise.id,
      equipmentId: caller.equipment.id,
      equipmentName: caller.equipment.name,
      setCount: 1,
    });
    expect(listed.backfills[1]?.undoneAt).toEqual(expect.any(Date));
    expect((await listHistoricalEquipmentBackfills(caller.user.id, 1)).backfills).toHaveLength(1);
  });

  it('removes the audit rows together with the owning account', async () => {
    const seeded = await seedBackfillCase('cascade');
    await applyHistoricalEquipmentBackfill(seeded.user.id, {
      gymId: seeded.gym.id,
      exerciseId: seeded.exercise.id,
      equipmentId: seeded.equipment.id,
      setIds: seeded.sets.map((set) => set.id),
      confirmed: true,
    });
    expect(await db.mcpHistoricalEquipmentBackfillAudit.count()).toBe(1);

    await db.set.deleteMany({ where: { session: { userId: seeded.user.id } } });
    await db.session.deleteMany({ where: { userId: seeded.user.id } });
    await db.gym.deleteMany({ where: { userId: seeded.user.id } });
    await db.exercise.deleteMany({ where: { userId: seeded.user.id } });
    await db.user.delete({ where: { id: seeded.user.id } });

    expect(await db.mcpHistoricalEquipmentBackfillAudit.count()).toBe(0);
  });
});

describe('historical equipment backfill MCP tools', () => {
  it('runs preview, apply, list and undo end to end for a legacy non-cuid gym id', async () => {
    const seeded = await seedBackfillCase('legacy', { gymId: 'gym_legacy_olymp' });
    const setIds = seeded.sets.map((set) => set.id);
    const client = await connect(seeded.user.id);

    const preview = await client.callTool({
      name: 'preview_historical_equipment_backfill',
      arguments: { gymId: 'gym_legacy_olymp' },
    });
    expect(preview.isError).toBeFalsy();
    expect((preview.structuredContent as { returnedMissingSets: number }).returnedMissingSets).toBe(
      2,
    );

    const applied = await client.callTool({
      name: 'apply_historical_equipment_backfill',
      arguments: {
        confirmed: true,
        gymId: 'gym_legacy_olymp',
        exerciseId: seeded.exercise.id,
        equipmentId: seeded.equipment.id,
        setIds,
      },
    });
    expect(applied.isError).toBeFalsy();
    const auditId = (applied.structuredContent as { auditId: string }).auditId;

    const listed = await client.callTool({
      name: 'list_historical_equipment_backfills',
      arguments: {},
    });
    expect(listed.isError).toBeFalsy();
    expect(
      (listed.structuredContent as { backfills: Array<{ auditId: string }> }).backfills.map(
        (audit) => audit.auditId,
      ),
    ).toEqual([auditId]);
    expect(JSON.stringify(listed.content)).not.toContain(seeded.firstSetId);

    const undone = await client.callTool({
      name: 'undo_historical_equipment_backfill',
      arguments: { confirmed: true, auditId },
    });
    expect(undone.isError).toBeFalsy();
    expect(await setEquipmentState(setIds)).toEqual([UNASSIGNED, UNASSIGNED]);
  });

  it('refuses apply and undo on a read-only token but still lets it preview and list', async () => {
    const seeded = await seedBackfillCase('read-only');
    const setIds = seeded.sets.map((set) => set.id);
    const applied = await applyHistoricalEquipmentBackfill(seeded.user.id, {
      gymId: seeded.gym.id,
      exerciseId: seeded.exercise.id,
      equipmentId: seeded.equipment.id,
      setIds: [seeded.firstSetId],
      confirmed: true,
    });
    const client = await connect(seeded.user.id, false);

    const apply = await client.callTool({
      name: 'apply_historical_equipment_backfill',
      arguments: {
        confirmed: true,
        gymId: seeded.gym.id,
        exerciseId: seeded.exercise.id,
        equipmentId: seeded.equipment.id,
        setIds: [seeded.secondSetId],
      },
    });
    expect(apply.isError).toBe(true);
    expect(JSON.stringify(apply.content)).toContain('read-only');

    const undo = await client.callTool({
      name: 'undo_historical_equipment_backfill',
      arguments: { confirmed: true, auditId: applied.auditId },
    });
    expect(undo.isError).toBe(true);
    expect(JSON.stringify(undo.content)).toContain('read-only');

    const after = await setEquipmentState(setIds);
    expect(after.map((set) => set.gymEquipmentId)).toEqual([seeded.equipment.id, null]);
    expect(await db.mcpHistoricalEquipmentBackfillAudit.count()).toBe(1);
    expect(
      await db.mcpHistoricalEquipmentBackfillAudit.findUnique({ where: { id: applied.auditId } }),
    ).toMatchObject({ undoneAt: null });

    const preview = await client.callTool({
      name: 'preview_historical_equipment_backfill',
      arguments: {},
    });
    expect(preview.isError).toBeFalsy();
    const listed = await client.callTool({
      name: 'list_historical_equipment_backfills',
      arguments: {},
    });
    expect(listed.isError).toBeFalsy();
  });

  it('refuses apply and undo unless confirmed is the literal true', async () => {
    const seeded = await seedBackfillCase('unconfirmed');
    const setIds = seeded.sets.map((set) => set.id);
    const applied = await applyHistoricalEquipmentBackfill(seeded.user.id, {
      gymId: seeded.gym.id,
      exerciseId: seeded.exercise.id,
      equipmentId: seeded.equipment.id,
      setIds: [seeded.firstSetId],
      confirmed: true,
    });
    const client = await connect(seeded.user.id);
    const applyArguments = {
      gymId: seeded.gym.id,
      exerciseId: seeded.exercise.id,
      equipmentId: seeded.equipment.id,
      setIds: [seeded.secondSetId],
    };

    for (const confirmation of [{ confirmed: false }, {}]) {
      const apply = await client.callTool({
        name: 'apply_historical_equipment_backfill',
        arguments: { ...applyArguments, ...confirmation },
      });
      expect(apply.isError).toBe(true);
      const undo = await client.callTool({
        name: 'undo_historical_equipment_backfill',
        arguments: { auditId: applied.auditId, ...confirmation },
      });
      expect(undo.isError).toBe(true);
    }

    const after = await setEquipmentState(setIds);
    expect(after.map((set) => set.gymEquipmentId)).toEqual([seeded.equipment.id, null]);
    expect(await db.mcpHistoricalEquipmentBackfillAudit.count()).toBe(1);
  });

  it("does not list or undo another user's backfill through the tools", async () => {
    const victim = await seedBackfillCase('tool-victim');
    const attacker = await seedBackfillCase('tool-attacker');
    const applied = await applyHistoricalEquipmentBackfill(victim.user.id, {
      gymId: victim.gym.id,
      exerciseId: victim.exercise.id,
      equipmentId: victim.equipment.id,
      setIds: victim.sets.map((set) => set.id),
      confirmed: true,
    });
    const client = await connect(attacker.user.id);

    const listed = await client.callTool({
      name: 'list_historical_equipment_backfills',
      arguments: {},
    });
    expect((listed.structuredContent as { backfills: unknown[] }).backfills).toEqual([]);

    const undo = await client.callTool({
      name: 'undo_historical_equipment_backfill',
      arguments: { confirmed: true, auditId: applied.auditId },
    });
    expect(undo.isError).toBe(true);
    expect(
      await db.mcpHistoricalEquipmentBackfillAudit.findUnique({ where: { id: applied.auditId } }),
    ).toMatchObject({ undoneAt: null });
  });

  it('validates the preview date range strictly and caps the limit at one apply', async () => {
    const seeded = await seedBackfillCase('dates');
    await db.session.update({
      where: { id: seeded.session.id },
      data: { startedAt: new Date('2026-08-31T18:00:00.000Z') },
    });
    const client = await connect(seeded.user.id);
    const preview = (args: Record<string, unknown>) =>
      client.callTool({ name: 'preview_historical_equipment_backfill', arguments: args });

    for (const bad of [
      { from: null },
      { from: 0 },
      { to: 'yesterday' },
      // Not a calendar date: the engine would roll it over to March 2.
      { from: '2026-02-30' },
      // No offset: it would depend on the server's time zone.
      { to: '2026-08-31T18:00:00' },
      { limit: 501 },
    ]) {
      expect((await preview(bad)).isError).toBe(true);
    }
    const reversed = await preview({ from: '2026-09-01', to: '2026-08-01' });
    expect(reversed.isError).toBe(true);
    expect(JSON.stringify(reversed.content)).toContain('from to be before to');

    // A date-only upper bound includes sessions started during that UTC day.
    const sameDay = await preview({ from: '2026-08-31', to: '2026-08-31' });
    expect(sameDay.isError).toBeFalsy();
    expect((sameDay.structuredContent as { returnedMissingSets: number }).returnedMissingSets).toBe(
      2,
    );
    const before = await preview({ to: '2026-08-30' });
    expect((before.structuredContent as { returnedMissingSets: number }).returnedMissingSets).toBe(
      0,
    );
  });
});
