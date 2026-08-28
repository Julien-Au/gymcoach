import { Prisma } from '@/prisma/generated/client';

type EquipmentReader = Pick<Prisma.TransactionClient, 'gymEquipment'>;

export interface SetEquipmentSnapshot {
  gymEquipmentId: string | null;
  equipmentNameSnapshot: string | null;
  equipmentLoadSnapshot: Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

export async function resolveSetEquipmentSnapshot(
  client: EquipmentReader,
  input: {
    userId: string;
    sessionGymId: string | null;
    exerciseId: string;
    gymEquipmentId?: string | null;
  },
): Promise<SetEquipmentSnapshot> {
  if (!input.gymEquipmentId) return emptySetEquipmentSnapshot();

  const equipment = await client.gymEquipment.findFirst({
    where: {
      id: input.gymEquipmentId,
      gym: { userId: input.userId },
      exerciseLinks: { some: { exerciseId: input.exerciseId } },
    },
    select: {
      id: true,
      gymId: true,
      name: true,
      equipmentType: true,
      manufacturer: true,
      modelName: true,
      weightOptions: true,
    },
  });
  // Equipment is optional decoration on a training set. A stale/deleted,
  // unlinked, foreign, or wrong-gym reference must never make the actual
  // weight/reps/RIR fail to record. Drop the reference and preserve the set.
  if (!equipment || !input.sessionGymId || equipment.gymId !== input.sessionGymId) {
    return emptySetEquipmentSnapshot();
  }

  const snapshot = {
    version: 1,
    equipmentType: equipment.equipmentType,
    manufacturer: equipment.manufacturer,
    modelName: equipment.modelName,
    weightOptions: equipment.weightOptions,
  } satisfies Prisma.InputJsonObject;

  return {
    gymEquipmentId: equipment.id,
    equipmentNameSnapshot: equipment.name,
    equipmentLoadSnapshot: snapshot,
  };
}

export function emptySetEquipmentSnapshot(): SetEquipmentSnapshot {
  return {
    gymEquipmentId: null,
    equipmentNameSnapshot: null,
    equipmentLoadSnapshot: Prisma.JsonNull,
  };
}
