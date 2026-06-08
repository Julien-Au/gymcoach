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

  // ============================================================
  // Additional common movements (machine, cable and accessory work)
  // ============================================================

  // Chest
  {
    name: 'Flat dumbbell bench press',
    muscleGroup: MuscleGroup.CHEST,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Dumbbells let each side work independently. Wrists stacked over the elbows. Touch at chest level, do not lock out hard.',
  },
  {
    name: 'Machine chest press',
    muscleGroup: MuscleGroup.CHEST,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 90,
    notes: 'Handles at mid-chest height. Drive through the chest, stop just short of lockout. Great for pushing close to failure safely.',
  },

  // Back
  {
    name: 'Neutral-grip lat pulldown',
    muscleGroup: MuscleGroup.BACK_WIDTH,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Palms facing, shoulder-width handle. Pull to the upper chest, drive the elbows down and back.',
  },
  {
    name: 'Straight-arm cable pulldown',
    muscleGroup: MuscleGroup.BACK_WIDTH,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 75,
    notes: 'Arms nearly straight, slight elbow bend held fixed. Drive the bar to the thighs with the lats. Big stretch at the top.',
  },
  {
    name: 'Chest-supported machine row',
    muscleGroup: MuscleGroup.BACK_THICKNESS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 90,
    notes: 'Chest pad removes lower-back fatigue. Row to the torso, squeeze the shoulder blades, control the stretch.',
  },
  {
    name: 'Single-arm dumbbell row',
    muscleGroup: MuscleGroup.BACK_THICKNESS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 90,
    notes: 'Knee and hand on the bench, flat back. Pull toward the hip, elbow close to the body. Full stretch at the bottom.',
  },

  // Shoulders
  {
    name: 'Standing barbell overhead press',
    muscleGroup: MuscleGroup.SHOULDERS_FRONT,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 150,
    notes: 'Brace the core, glutes tight, no excessive arch. Bar travels over the mid-foot. Lock out with the head through.',
  },
  {
    name: 'Dumbbell lateral raise',
    muscleGroup: MuscleGroup.SHOULDERS_LATERAL,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Slight forward lean, elbows soft. Lead with the elbows to shoulder height. Control the descent, no swinging.',
  },
  {
    name: 'Face pull (rope)',
    muscleGroup: MuscleGroup.SHOULDERS_REAR,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Cable at face height. Pull the rope apart toward the forehead, externally rotate. Rear delts and upper back.',
  },

  // Biceps
  {
    name: 'Standing cable curl (straight bar)',
    muscleGroup: MuscleGroup.BICEPS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Constant cable tension through the range. Elbows pinned. Squeeze 1s at the top, no swinging.',
  },
  {
    name: 'Concentration curl',
    muscleGroup: MuscleGroup.BICEPS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Seated, elbow braced on the inner thigh. Strict, full contraction. High peak-contraction tension.',
  },

  // Forearms
  {
    name: 'Barbell wrist curl',
    muscleGroup: MuscleGroup.FOREARMS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Forearms on the thighs or a bench, palms up. Let the bar roll to the fingers, then curl the wrists up. Full range, no momentum.',
  },
  {
    name: 'Reverse EZ-bar curl',
    muscleGroup: MuscleGroup.FOREARMS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Pronated (palms down) grip. Targets the brachioradialis and wrist extensors. Lighter load, strict tempo.',
  },

  // Biceps (brachialis emphasis)
  {
    name: 'Hammer curl (dumbbell)',
    muscleGroup: MuscleGroup.BICEPS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Neutral grip throughout. Emphasizes the brachialis and brachioradialis. Elbows fixed, no swinging.',
  },

  // Triceps
  {
    name: 'Close-grip bench press',
    muscleGroup: MuscleGroup.TRICEPS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Grip just inside shoulder width. Elbows tucked. Bar to the lower chest. Triceps-biased pressing.',
  },
  {
    name: 'Overhead cable triceps extension',
    muscleGroup: MuscleGroup.TRICEPS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Rope from a low or high pulley, facing away. Long-head stretch overhead. Extend fully, keep the elbows in.',
  },
  {
    name: 'EZ-bar skull crusher',
    muscleGroup: MuscleGroup.TRICEPS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 75,
    notes: 'Lower to the forehead or behind the head for more stretch. Elbows pointing up, kept narrow. Controlled descent.',
  },

  // Quads
  {
    name: 'Leg press (45 deg)',
    muscleGroup: MuscleGroup.QUADS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 150,
    notes: 'Feet mid-platform, shoulder width. Lower until the knees reach the chest without the lower back rounding. Do not lock out hard.',
  },
  {
    name: 'Goblet squat',
    muscleGroup: MuscleGroup.QUADS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Hold a dumbbell at the chest. Upright torso, elbows inside the knees at the bottom. Great for learning depth.',
  },
  {
    name: 'Bulgarian split squat',
    muscleGroup: MuscleGroup.QUADS,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 90,
    notes: 'Rear foot elevated. Most weight on the front leg, vertical shin bias for quads. Control the descent.',
  },

  // Hamstrings
  {
    name: 'Lying leg curl',
    muscleGroup: MuscleGroup.HAMSTRINGS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 75,
    notes: 'Hips pinned to the pad. Curl fully, pause 1s at the contraction, control the negative. No hip lift.',
  },

  // Glutes
  {
    name: 'Cable glute kickback',
    muscleGroup: MuscleGroup.GLUTES,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Ankle strap on a low pulley. Hinge slightly, drive the heel back and up. Squeeze the glute at the top, no lower-back arch.',
  },

  // Lower back
  {
    name: 'Back extension (hyperextension)',
    muscleGroup: MuscleGroup.LOWER_BACK,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    usesBodyweight: true,
    notes: 'Hips on the pad. Round and extend through the spine, or stay rigid to bias the glutes. Add a plate for load.',
  },
  {
    name: 'Barbell good morning',
    muscleGroup: MuscleGroup.LOWER_BACK,
    category: ExerciseCategory.COMPOUND,
    defaultRestSec: 120,
    notes: 'Bar on the upper back. Hinge at the hips with a flat back, soft knees. Light load, feel the spinal erectors and hamstrings.',
  },

  // Abs
  {
    name: 'Machine crunch',
    muscleGroup: MuscleGroup.ABS,
    category: ExerciseCategory.ISOLATION,
    defaultRestSec: 60,
    notes: 'Flex the spine against the resistance, ribs toward the pelvis. Controlled tempo, pause at the contraction.',
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
