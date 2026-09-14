import { db } from '@/lib/db';
import { resolveSetEquipmentSnapshot } from '@/lib/set-equipment';
import { Prisma } from '@/prisma/generated/client';

export interface HistoricalEquipmentGapQuery {
  gymId?: string;
  exerciseId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export async function previewHistoricalEquipmentBackfill(
  userId: string,
  input: HistoricalEquipmentGapQuery,
) {
  const limit = Math.max(1, Math.min(input.limit ?? 500, 2000));
  const dateFilter =
    input.from || input.to
      ? {
          startedAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lte: input.to } : {}),
          },
        }
      : {};

  const rows = await db.set.findMany({
    where: {
      gymEquipmentId: null,
      ...(input.exerciseId ? { exerciseId: input.exerciseId } : {}),
      session: {
        userId,
        ...(input.gymId ? { gymId: input.gymId } : {}),
        ...dateFilter,
      },
    },
    orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    select: {
      id: true,
      setNumber: true,
      weight: true,
      reps: true,
      completedAt: true,
      exercise: { select: { id: true, name: true, equipmentType: true } },
      session: {
        select: {
          id: true,
          gymId: true,
          startedAt: true,
          gym: { select: { id: true, name: true } },
        },
      },
    },
  });

  const truncated = rows.length > limit;
  const gaps = rows.slice(0, limit);
  const gymIds = [
    ...new Set(gaps.flatMap((row) => (row.session.gymId ? [row.session.gymId] : []))),
  ];
  const exerciseIds = [...new Set(gaps.map((row) => row.exercise.id))];

  const [equipment, assignedEvidence] = await Promise.all([
    gymIds.length && exerciseIds.length
      ? db.gymEquipment.findMany({
          where: {
            gymId: { in: gymIds },
            gym: { userId },
            exerciseLinks: { some: { exerciseId: { in: exerciseIds } } },
          },
          orderBy: [{ gymId: 'asc' }, { name: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            gymId: true,
            name: true,
            equipmentType: true,
            exerciseLinks: { select: { exerciseId: true } },
          },
        })
      : Promise.resolve([]),
    gymIds.length && exerciseIds.length
      ? db.set.findMany({
          where: {
            gymEquipmentId: { not: null },
            exerciseId: { in: exerciseIds },
            session: { userId, gymId: { in: gymIds } },
          },
          orderBy: { completedAt: 'desc' },
          take: 5000,
          select: {
            exerciseId: true,
            gymEquipmentId: true,
            session: { select: { gymId: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const groups = new Map<
    string,
    {
      gymId: string | null;
      gymName: string | null;
      exerciseId: string;
      exerciseName: string;
      equipmentType: string;
      missingSetIds: string[];
      examples: Array<Record<string, unknown>>;
    }
  >();

  for (const row of gaps) {
    const key = pairKey(row.session.gymId, row.exercise.id);
    const current = groups.get(key) ?? {
      gymId: row.session.gymId,
      gymName: row.session.gym?.name ?? null,
      exerciseId: row.exercise.id,
      exerciseName: row.exercise.name,
      equipmentType: row.exercise.equipmentType,
      missingSetIds: [],
      examples: [],
    };
    current.missingSetIds.push(row.id);
    if (current.examples.length < 8) {
      current.examples.push({
        setId: row.id,
        sessionId: row.session.id,
        date: row.session.startedAt.toISOString().slice(0, 10),
        setNumber: row.setNumber,
        weightKg: row.weight,
        reps: row.reps,
        completedAt: row.completedAt.toISOString(),
      });
    }
    groups.set(key, current);
  }

  const evidenceCounts = new Map<string, number>();
  for (const row of assignedEvidence) {
    if (!row.session.gymId || !row.gymEquipmentId) continue;
    const key = pairKey(row.session.gymId, row.exerciseId) + '\u0000' + row.gymEquipmentId;
    evidenceCounts.set(key, (evidenceCounts.get(key) ?? 0) + 1);
  }

  const serializedGroups = [...groups.values()].map((group) => {
    const candidates = equipment
      .filter(
        (item) =>
          item.gymId === group.gymId &&
          item.exerciseLinks.some((link) => link.exerciseId === group.exerciseId),
      )
      .map((item) => ({
        equipmentId: item.id,
        name: item.name,
        equipmentType: item.equipmentType,
        assignedHistoricalSetCount:
          evidenceCounts.get(pairKey(group.gymId, group.exerciseId) + '\u0000' + item.id) ?? 0,
      }));
    const mostUsed =
      [...candidates].sort(
        (left, right) => right.assignedHistoricalSetCount - left.assignedHistoricalSetCount,
      )[0] ?? null;
    const suggestedEquipment =
      candidates.length === 1
        ? { ...candidates[0], reason: 'ONLY_LINKED_EQUIPMENT' as const }
        : mostUsed && mostUsed.assignedHistoricalSetCount > 0
          ? { ...mostUsed, reason: 'MOST_USED_ASSIGNED_HISTORY' as const }
          : null;

    return {
      gym: group.gymId ? { id: group.gymId, name: group.gymName } : null,
      exercise: {
        id: group.exerciseId,
        name: group.exerciseName,
        equipmentType: group.equipmentType,
      },
      missingSetCount: group.missingSetIds.length,
      missingSetIds: group.missingSetIds,
      examples: group.examples,
      candidateEquipment: candidates,
      suggestedEquipment,
      suggestionIsConfirmation: false,
    };
  });

  return {
    ok: true as const,
    returnedMissingSets: gaps.length,
    truncated,
    limit,
    filters: {
      gymId: input.gymId ?? null,
      exerciseId: input.exerciseId ?? null,
      from: input.from?.toISOString() ?? null,
      to: input.to?.toISOString() ?? null,
    },
    groups: serializedGroups,
    guidance:
      'Suggestions are evidence for review, not authorization. Confirm the exact equipment mapping with the trainee before applying any historical backfill.',
  };
}

export interface ApplyHistoricalEquipmentBackfillInput {
  gymId: string;
  exerciseId: string;
  equipmentId: string;
  setIds: string[];
  confirmed: boolean;
}

export async function applyHistoricalEquipmentBackfill(
  userId: string,
  input: ApplyHistoricalEquipmentBackfillInput,
) {
  if (input.confirmed !== true) {
    throw new Error('Historical equipment backfill requires explicit confirmation.');
  }

  const setIds = [...new Set(input.setIds)];
  if (setIds.length === 0 || setIds.length > 500) {
    throw new Error('Historical equipment backfill requires between 1 and 500 unique set IDs.');
  }

  return db.$transaction(async (tx) => {
    const equipmentSnapshot = await resolveSetEquipmentSnapshot(tx, {
      userId,
      sessionGymId: input.gymId,
      exerciseId: input.exerciseId,
      gymEquipmentId: input.equipmentId,
    });
    if (equipmentSnapshot.gymEquipmentId !== input.equipmentId) {
      throw new Error(
        'Equipment mapping is not owned, linked to the exercise, and in the target gym.',
      );
    }

    const eligibleSets = await tx.set.findMany({
      where: {
        id: { in: setIds },
        exerciseId: input.exerciseId,
        gymEquipmentId: null,
        session: { userId, gymId: input.gymId },
      },
      select: { id: true },
    });
    if (eligibleSets.length !== setIds.length) {
      throw new Error(
        'Backfill aborted: every requested set must still be owned, belong to the exact gym/exercise mapping, and have no equipment assignment.',
      );
    }

    const updated = await tx.set.updateMany({
      where: {
        id: { in: setIds },
        exerciseId: input.exerciseId,
        gymEquipmentId: null,
        session: { userId, gymId: input.gymId },
      },
      data: equipmentSnapshot,
    });
    if (updated.count !== setIds.length) {
      throw new Error(
        'Backfill aborted because the eligible set collection changed during the transaction.',
      );
    }

    const audit = await tx.mcpHistoricalEquipmentBackfillAudit.create({
      data: {
        userId,
        gymId: input.gymId,
        exerciseId: input.exerciseId,
        equipmentId: input.equipmentId,
        setIds,
        equipmentSnapshot: {
          gymEquipmentId: equipmentSnapshot.gymEquipmentId,
          equipmentNameSnapshot: equipmentSnapshot.equipmentNameSnapshot,
          // A non-null gymEquipmentId above proves resolveSetEquipmentSnapshot
          // returned its version-1 JSON object rather than Prisma.JsonNull.
          equipmentLoadSnapshot: equipmentSnapshot.equipmentLoadSnapshot as Prisma.InputJsonValue,
        },
      },
      select: { id: true, createdAt: true },
    });

    return {
      ok: true as const,
      auditId: audit.id,
      createdAt: audit.createdAt,
      appliedSetIds: setIds,
      appliedSetCount: setIds.length,
      equipmentSnapshot,
    };
  });
}

function pairKey(gymId: string | null, exerciseId: string) {
  return (gymId ?? '<no-gym>') + '\u0000' + exerciseId;
}
