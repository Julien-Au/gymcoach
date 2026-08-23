import { Buffer } from 'node:buffer';
import { ApiError } from '@/lib/api';
import { db } from '@/lib/db';
import type { EquipmentType } from '@/lib/prisma-client';

export const GYM_EQUIPMENT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type GymEquipmentImageMimeType = (typeof GYM_EQUIPMENT_IMAGE_MIME_TYPES)[number];
export const MAX_GYM_EQUIPMENT_IMAGE_BYTES = 5 * 1024 * 1024;

export interface UpsertGymEquipmentInput {
  equipmentId?: string;
  name: string;
  equipmentType: EquipmentType;
  description?: string | null;
  manufacturer?: string | null;
  modelName?: string | null;
  quantity?: number;
  weightOptions?: number[];
  exerciseIds?: string[];
  markExercisesAvailable?: boolean;
}

export interface SetGymEquipmentImageInput {
  clear?: boolean;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: GymEquipmentImageMimeType;
}

const equipmentSelection = {
  id: true,
  gymId: true,
  name: true,
  equipmentType: true,
  description: true,
  manufacturer: true,
  modelName: true,
  quantity: true,
  weightOptions: true,
  imageUrl: true,
  imageMimeType: true,
  createdAt: true,
  updatedAt: true,
  exerciseLinks: {
    orderBy: { exercise: { name: 'asc' as const } },
    include: {
      exercise: {
        select: {
          id: true,
          name: true,
          muscleGroup: true,
          category: true,
          equipmentType: true,
        },
      },
    },
  },
} as const;

export async function listOwnedGymEquipment(userId: string, gymId: string, baseUrl: string) {
  await requireOwnedGym(userId, gymId);
  const equipment = await db.gymEquipment.findMany({
    where: { gymId },
    orderBy: { name: 'asc' },
    select: equipmentSelection,
  });
  return equipment.map((item) => ({
    ...item,
    image: item.imageMimeType
      ? {
          kind: 'uploaded' as const,
          url: new URL(
            `/api/gym-equipment/${item.id}/image?v=${item.updatedAt.getTime()}`,
            baseUrl,
          ).toString(),
          mimeType: item.imageMimeType,
        }
      : item.imageUrl
        ? { kind: 'external' as const, url: item.imageUrl, mimeType: null }
        : null,
    exerciseLinks: item.exerciseLinks.map((link) => link.exercise),
  }));
}

export async function upsertOwnedGymEquipment(
  userId: string,
  gymId: string,
  input: UpsertGymEquipmentInput,
) {
  await requireOwnedGym(userId, gymId);
  const requestedExerciseIds = input.exerciseIds ? [...new Set(input.exerciseIds)] : undefined;
  const current = input.equipmentId
    ? await db.gymEquipment.findFirst({
        where: { id: input.equipmentId, gymId },
        select: {
          id: true,
          equipmentType: true,
          weightOptions: true,
          exerciseLinks: { select: { exerciseId: true } },
        },
      })
    : await db.gymEquipment.findFirst({
        where: { gymId, name: { equals: input.name, mode: 'insensitive' } },
        select: {
          id: true,
          equipmentType: true,
          weightOptions: true,
          exerciseLinks: { select: { exerciseId: true } },
        },
      });
  if (input.equipmentId && !current) throw new ApiError(404, 'Gym equipment not found.');

  const exerciseIds =
    requestedExerciseIds ?? current?.exerciseLinks.map((link) => link.exerciseId) ?? [];
  const exercises = exerciseIds.length
    ? await db.exercise.findMany({
        where: { userId, id: { in: exerciseIds } },
        select: { id: true, name: true, equipmentType: true },
      })
    : [];
  if (exercises.length !== exerciseIds.length) {
    throw new ApiError(400, 'One or more exercise IDs do not belong to the trainee.');
  }

  const equipmentTypeChanged = current != null && current.equipmentType !== input.equipmentType;
  const shouldSyncExerciseConfigs =
    requestedExerciseIds !== undefined || input.weightOptions !== undefined || equipmentTypeChanged;
  const effectiveWeightOptions = input.weightOptions ?? current?.weightOptions ?? [];

  const item = await db.$transaction(async (tx) => {
    const saved = current
      ? await tx.gymEquipment.update({
          where: { id: current.id },
          data: {
            name: input.name,
            equipmentType: input.equipmentType,
            description: input.description,
            manufacturer: input.manufacturer,
            modelName: input.modelName,
            quantity: input.quantity,
            weightOptions: input.weightOptions,
          },
        })
      : await tx.gymEquipment.create({
          data: {
            gymId,
            name: input.name,
            equipmentType: input.equipmentType,
            description: input.description,
            manufacturer: input.manufacturer,
            modelName: input.modelName,
            quantity: input.quantity ?? 1,
            weightOptions: input.weightOptions ?? [],
          },
        });

    if (requestedExerciseIds !== undefined) {
      await tx.gymEquipmentExercise.deleteMany({ where: { equipmentId: saved.id } });
      if (requestedExerciseIds.length > 0) {
        await tx.gymEquipmentExercise.createMany({
          data: requestedExerciseIds.map((exerciseId) => ({ equipmentId: saved.id, exerciseId })),
        });
      }
    }

    // Keep the already-accepted GymExerciseConfig model in sync as a compatibility
    // projection. Later equipment-first workout code can use the physical item
    // directly, while current upstream screens immediately see linked exercises
    // as available and retain their machine/cable load options.
    if (input.markExercisesAvailable !== false && shouldSyncExerciseConfigs) {
      const useItemWeights = ['MACHINE', 'CABLE', 'OTHER'].includes(input.equipmentType);
      for (const exercise of exercises) {
        await tx.gymExerciseConfig.upsert({
          where: { gymId_exerciseId: { gymId, exerciseId: exercise.id } },
          update: {
            isAvailable: true,
            ...(useItemWeights
              ? { weightOptions: effectiveWeightOptions }
              : equipmentTypeChanged
                ? { weightOptions: [] }
                : {}),
          },
          create: {
            gymId,
            exerciseId: exercise.id,
            isAvailable: true,
            weightOptions: useItemWeights ? effectiveWeightOptions : [],
          },
        });
      }
    }
    return saved;
  });

  const saved = await db.gymEquipment.findUnique({ where: { id: item.id }, select: equipmentSelection });
  if (!saved) throw new ApiError(500, 'Gym equipment could not be read after saving.');

  const mismatchedExercises = exercises
    .filter(
      (exercise) =>
        exercise.equipmentType !== 'OTHER' &&
        input.equipmentType !== 'OTHER' &&
        exercise.equipmentType !== input.equipmentType,
    )
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      exerciseEquipmentType: exercise.equipmentType,
    }));

  return { equipment: saved, mismatchedExercises };
}

export async function deleteOwnedGymEquipment(userId: string, equipmentId: string) {
  const equipment = await requireOwnedEquipment(userId, equipmentId);
  await db.gymEquipment.delete({ where: { id: equipment.id } });
}

export async function getOwnedGymEquipmentImage(userId: string, equipmentId: string) {
  const equipment = await db.gymEquipment.findFirst({
    where: { id: equipmentId, gym: { userId } },
    select: {
      id: true,
      imageUrl: true,
      imageData: true,
      imageMimeType: true,
      updatedAt: true,
    },
  });
  if (!equipment) throw new ApiError(404, 'Gym equipment not found.');

  if (equipment.imageData && equipment.imageMimeType) {
    if (!GYM_EQUIPMENT_IMAGE_MIME_TYPES.includes(equipment.imageMimeType as GymEquipmentImageMimeType)) {
      throw new ApiError(500, 'Gym equipment image has an unsupported MIME type.');
    }
    return {
      kind: 'uploaded' as const,
      bytes: Buffer.from(equipment.imageData),
      mimeType: equipment.imageMimeType as GymEquipmentImageMimeType,
      updatedAt: equipment.updatedAt,
    };
  }
  if (equipment.imageUrl) {
    return { kind: 'external' as const, url: equipment.imageUrl, updatedAt: equipment.updatedAt };
  }
  throw new ApiError(404, 'Gym equipment image not found.');
}

export async function setOwnedGymEquipmentImage(
  userId: string,
  equipmentId: string,
  input: SetGymEquipmentImageInput,
) {
  const equipment = await requireOwnedEquipment(userId, equipmentId);
  const modes = [input.clear === true, input.imageUrl != null, input.imageBase64 != null].filter(Boolean)
    .length;
  if (modes !== 1) {
    throw new ApiError(400, 'Choose exactly one image action: clear, imageUrl, or imageBase64.');
  }

  const data = input.clear
    ? { imageUrl: null, imageData: null, imageMimeType: null }
    : input.imageUrl
      ? { imageUrl: input.imageUrl, imageData: null, imageMimeType: null }
      : (() => {
          const decoded = decodeGymEquipmentImage(input.imageBase64!, input.mimeType);
          return { imageUrl: null, imageData: decoded.bytes, imageMimeType: decoded.mimeType };
        })();

  return db.gymEquipment.update({
    where: { id: equipment.id },
    data,
    select: { id: true, gymId: true, name: true, imageUrl: true, imageMimeType: true, updatedAt: true },
  });
}

export function decodeGymEquipmentImage(
  raw: string,
  declaredMimeType?: GymEquipmentImageMimeType,
): { bytes: Uint8Array<ArrayBuffer>; mimeType: GymEquipmentImageMimeType } {
  const dataUrl = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(raw.trim());
  const mimeType = (dataUrl?.[1] ?? declaredMimeType) as GymEquipmentImageMimeType | undefined;
  if (!mimeType || !GYM_EQUIPMENT_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new ApiError(400, 'Uploaded equipment image must be JPEG, PNG, or WebP.');
  }
  if (dataUrl && declaredMimeType && dataUrl[1] !== declaredMimeType) {
    throw new ApiError(400, 'The declared image MIME type does not match the data URL.');
  }

  const base64 = (dataUrl?.[2] ?? raw).replace(/\s/g, '');
  if (base64.length > Math.ceil((MAX_GYM_EQUIPMENT_IMAGE_BYTES * 4) / 3) + 16) {
    throw new ApiError(400, 'Uploaded equipment image is larger than 5 MB.');
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new ApiError(400, 'Invalid base64 image data.');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) throw new ApiError(400, 'Uploaded equipment image is empty.');
  if (buffer.length > MAX_GYM_EQUIPMENT_IMAGE_BYTES) {
    throw new ApiError(400, 'Uploaded equipment image is larger than 5 MB.');
  }
  if (!matchesImageSignature(buffer, mimeType)) {
    throw new ApiError(400, 'Uploaded bytes do not match the declared image type.');
  }
  const bytes = new Uint8Array(new ArrayBuffer(buffer.length));
  bytes.set(buffer);
  return { bytes, mimeType };
}

async function requireOwnedGym(userId: string, gymId: string) {
  const gym = await db.gym.findFirst({ where: { id: gymId, userId }, select: { id: true } });
  if (!gym) throw new ApiError(404, 'Gym not found.');
  return gym;
}

async function requireOwnedEquipment(userId: string, equipmentId: string) {
  const equipment = await db.gymEquipment.findFirst({
    where: { id: equipmentId, gym: { userId } },
    select: { id: true, gymId: true },
  });
  if (!equipment) throw new ApiError(404, 'Gym equipment not found.');
  return equipment;
}

function matchesImageSignature(buffer: Buffer, mimeType: GymEquipmentImageMimeType): boolean {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}
