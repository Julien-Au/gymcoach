import { MuscleGroup, ExerciseCategory, type PrismaClient } from '@prisma/client';

// ============================================================
// Default exercise catalog
// ============================================================
// Seeded per user: at registration (so a new account is not empty) and by the
// demo seed. Generic, evidence-informed technique cues, no personal data.

export interface CatalogExercise {
  name: string;
  muscleGroup: MuscleGroup;
  category: ExerciseCategory;
  defaultRestSec: number;
  usesBodyweight?: boolean;
  notes?: string;
}

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // Chest
  {
    name: 'Barbell bench press',
    muscleGroup: MuscleGroup.CHEST,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 150,
    notes: 'Bar in the heel of the palm, wrist aligned with the forearm. Elbows at 45 degrees from the torso. Touch the chest.',
  },
  {
    name: 'Incline dumbbell press (30 deg)',
    muscleGroup: MuscleGroup.CHEST,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Bench at 30 degrees. Tempo 3-0-1-0. Do not lock the elbows at the top. Upper-chest focus.',
  },
  {
    name: 'Pec deck (or cable fly)',
    muscleGroup: MuscleGroup.CHEST,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 75,
    notes: 'Elbows 5 to 10 degrees below the shoulder line. Driven by the elbows. Pause at the stretch and at the contraction.',
  },

  // Back
  {
    name: 'Pronated pull-ups (weighted if possible)',
    muscleGroup: MuscleGroup.BACK_WIDTH,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    usesBodyweight: true,
    notes: 'Pronated grip, shoulder width + 10 cm. Strict tempo. Pull with the elbows toward the hips. Add load once 4x10 is reached.',
  },
  {
    name: 'Lat pulldown (wide grip)',
    muscleGroup: MuscleGroup.BACK_WIDTH,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Wide pronated grip. Pull to the collarbones, shoulder blades down. Torso slightly leaned back.',
  },
  {
    name: 'Bent-over barbell row',
    muscleGroup: MuscleGroup.BACK_THICKNESS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Torso 30 to 45 degrees, flat back. Pull toward the navel. Elbows close to the body.',
  },
  {
    name: 'Seated cable row (close handles)',
    muscleGroup: MuscleGroup.BACK_THICKNESS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 90,
    notes: 'Parallel handles. Pull toward the navel. Squeeze the shoulder blades. Elbows close to the body.',
  },

  // Shoulders
  {
    name: 'Seated dumbbell overhead press',
    muscleGroup: MuscleGroup.SHOULDERS_FRONT,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Bench at 90 degrees with a backrest. No lower-back arch. Lower down to the ears.',
  },
  {
    name: 'Cable lateral raises',
    muscleGroup: MuscleGroup.SHOULDERS_LATERAL,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Cable in front of the body. Elbow slightly bent. Lead with the elbow. Stop at shoulder height. Slow descent.',
  },
  {
    name: 'Machine rear delt fly',
    muscleGroup: MuscleGroup.SHOULDERS_REAR,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Reverse pec deck. Driven by the elbows toward the back. Palms facing the floor. Squeeze 1s.',
  },

  // Biceps
  {
    name: 'EZ-bar curl',
    muscleGroup: MuscleGroup.BICEPS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 75,
    notes: 'No swinging. Squeeze 1s at the top. Elbows close to the body.',
  },
  {
    name: 'Incline dumbbell curl (bench 60 deg)',
    muscleGroup: MuscleGroup.BICEPS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 75,
    notes: 'Bench at 60 degrees. Elbows behind the torso, fixed. Supinate on the way up. Full stretch at the bottom (Maeo 2021).',
  },

  // Triceps
  {
    name: 'Machine dips or parallel bars',
    muscleGroup: MuscleGroup.TRICEPS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 75,
    usesBodyweight: true,
    notes: 'Vertical torso for triceps focus. On an assisted machine, enter the assistance weight as negative.',
  },
  {
    name: 'Triceps pushdown (rope)',
    muscleGroup: MuscleGroup.TRICEPS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Elbows pinned to the body. Spread the rope at the bottom. Do not snap the elbow into lockout (95% max extension).',
  },

  // Quads
  {
    name: 'Machine squat (or Hack squat)',
    muscleGroup: MuscleGroup.QUADS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 150,
    notes: 'Depth to parallel thighs. Controlled 3s descent.',
  },
  {
    name: 'Leg extension',
    muscleGroup: MuscleGroup.QUADS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 75,
    notes: 'Pause 1s at the top. Neutral feet.',
  },
  {
    name: 'Walking lunges with dumbbells',
    muscleGroup: MuscleGroup.QUADS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 90,
    notes: 'Knee to 1 cm from the floor, no bounce.',
  },

  // Hamstrings
  {
    name: 'Dumbbell Romanian Deadlift',
    muscleGroup: MuscleGroup.HAMSTRINGS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Push the hips back, flat back. Knees slightly bent. Maximal hamstring stretch.',
  },
  {
    name: 'Seated leg curl',
    muscleGroup: MuscleGroup.HAMSTRINGS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 75,
    notes: 'Pause 1s at the contraction. Full range of motion.',
  },

  // Glutes
  {
    name: 'Barbell hip thrust (or machine)',
    muscleGroup: MuscleGroup.GLUTES,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Pause 1s at the top, neutral neck. Lock the glutes at the top.',
  },

  // Adductors
  {
    name: 'Hip adduction machine',
    muscleGroup: MuscleGroup.QUADS, // approximation, no dedicated group
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Pause 1s at the contraction.',
  },

  // Calves
  {
    name: 'Standing calf raise (or machine)',
    muscleGroup: MuscleGroup.CALVES,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Gastrocnemius (legs straight). Full range, pause 1s at the bottom. No bounce.',
  },
  {
    name: 'Seated calf raise machine',
    muscleGroup: MuscleGroup.CALVES,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Soleus (legs bent 90 degrees). Pause at the bottom stretch. Tempo 3-1-1-1. No bounce.',
  },

  // Abs
  {
    name: 'Cable crunch (kneeling)',
    muscleGroup: MuscleGroup.ABS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Hips locked. Roll the spine. Bring the ribs toward the pelvis.',
  },
  {
    name: 'Hanging leg raises',
    muscleGroup: MuscleGroup.ABS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    usesBodyweight: true,
    notes: 'Control 2s on the way down. No swinging.',
  },
  {
    name: 'Plank + side plank',
    muscleGroup: MuscleGroup.ABS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 45,
    usesBodyweight: true,
    notes: 'Core stability. 1 round as a finisher.',
  },
];

// Upserts the default catalog for a user. Returns a name -> exercise id map so
// callers can wire up a starter program. Idempotent (safe to re-run).
export async function seedExerciseCatalog(
  prisma: PrismaClient,
  userId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const data of EXERCISE_CATALOG) {
    const exercise = await prisma.exercise.upsert({
      where: { userId_name: { userId, name: data.name } },
      update: data,
      create: { ...data, userId },
    });
    map.set(data.name, exercise.id);
  }
  return map;
}
