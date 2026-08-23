import { ApiError } from '@/lib/api';
import { Prisma } from '@/prisma/generated/client';

type EquipmentReader = Pick<Prisma.TransactionClient, 'gymEquipment'>;

export interface SetEquipmentSnapshot {
  gymEquipmentId: string | null;
  equipmentNameSnapshot: string | null;
  selectedLoadKg: number | null;
  selectedLoadMultiplierSnapshot: number | null;
  nominalResistanceKg: number | null;
  equipmentLoadSnapshot: Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

export async function resolveSetEquipmentSnapshot(
  client: EquipmentReader,
  input: {
    userId: string;
    sessionGymId: string | null;
    exerciseId: string;
    gymEquipmentId?: string | null;
    selectedLoadKg: number;
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
  if (!equipment) {
    throw new ApiError(400, 'Equipment is not available for this exercise.');
  }
  if (!input.sessionGymId || equipment.gymId !== input.sessionGymId) {
    throw new ApiError(400, 'Equipment must belong to the gym frozen on this session.');
  }

  const selectedLoadKg = round(input.selectedLoadKg);
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
    selectedLoadKg,
    selectedLoadMultiplierSnapshot: null,
    nominalResistanceKg: null,
    equipmentLoadSnapshot: snapshot,
  };
}

export function emptySetEquipmentSnapshot(): SetEquipmentSnapshot {
  return {
    gymEquipmentId: null,
    equipmentNameSnapshot: null,
    selectedLoadKg: null,
    selectedLoadMultiplierSnapshot: null,
    nominalResistanceKg: null,
    equipmentLoadSnapshot: Prisma.JsonNull,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
