import type {
  BodyMeasurementSite,
  EquipmentType,
  ExerciseCategory,
  MuscleGroup,
} from '@/lib/prisma-client';

export const muscleGroupMessageKeys = {
  CHEST: 'chest',
  BACK_WIDTH: 'backWidth',
  BACK_THICKNESS: 'backThickness',
  SHOULDERS_FRONT: 'shouldersFront',
  SHOULDERS_LATERAL: 'shouldersLateral',
  SHOULDERS_REAR: 'shouldersRear',
  BICEPS: 'biceps',
  TRICEPS: 'triceps',
  FOREARMS: 'forearms',
  QUADS: 'quads',
  HAMSTRINGS: 'hamstrings',
  GLUTES: 'glutes',
  CALVES: 'calves',
  ABS: 'abs',
  LOWER_BACK: 'lowerBack',
  OTHER: 'other',
} as const satisfies Record<MuscleGroup, string>;

export const exerciseCategoryMessageKeys = {
  COMPOUND: 'compound',
  ISOLATION: 'isolation',
  CARDIO: 'cardio',
} as const satisfies Record<ExerciseCategory, string>;

export const equipmentTypeMessageKeys = {
  DUMBBELL: 'dumbbell',
  BARBELL: 'barbell',
  MACHINE: 'machine',
  CABLE: 'cable',
  BODYWEIGHT: 'bodyweight',
  CARDIO: 'cardio',
  OTHER: 'other',
} as const satisfies Record<EquipmentType, string>;

export const measurementSiteMessageKeys = {
  NECK: 'neck',
  SHOULDERS: 'shoulders',
  CHEST: 'chest',
  WAIST: 'waist',
  HIPS: 'hips',
  ARM_LEFT: 'armLeft',
  ARM_RIGHT: 'armRight',
  FOREARM_LEFT: 'forearmLeft',
  FOREARM_RIGHT: 'forearmRight',
  THIGH_LEFT: 'thighLeft',
  THIGH_RIGHT: 'thighRight',
  CALF_LEFT: 'calfLeft',
  CALF_RIGHT: 'calfRight',
} as const satisfies Record<BodyMeasurementSite, string>;
