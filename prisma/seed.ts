/**
 * Demo seed for GymCoach (open-source edition).
 *
 * Loads a neutral dataset to help you explore the application:
 * - A demo account (email/password configurable via .env)
 * - An exercise catalog with muscleGroup, category and technique cues
 * - A demo program "Hypertrophy - Phase 1" (Upper / Lower / Full Body)
 * - A sample session, so the charts and suggestions have data
 *
 * No personal data here: feel free to adapt the catalog and the program.
 *
 * Usage: npm run db:seed
 */

import { PrismaClient, MuscleGroup, ExerciseCategory } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed: starting...');

  // ============================================================
  // 1. DEMO ACCOUNT
  // ============================================================
  const passwordHash = await bcrypt.hash(
    process.env.USER_PASSWORD || 'change-me-immediately',
    10,
  );

  const user = await prisma.user.upsert({
    where: { email: process.env.USER_EMAIL || 'you@example.com' },
    update: {},
    create: {
      email: process.env.USER_EMAIL || 'you@example.com',
      passwordHash,
      bodyweight: 75,
    },
  });

  console.log(`Seed: demo account -> ${user.email}`);

  // ============================================================
  // 2. EXERCISE CATALOG (generic technique cues)
  // ============================================================
  const exercisesData = [
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

  const exerciseMap = new Map<string, string>();
  for (const data of exercisesData) {
    const exercise = await prisma.exercise.upsert({
      where: { userId_name: { userId: user.id, name: data.name } },
      update: data,
      create: { ...data, userId: user.id },
    });
    exerciseMap.set(data.name, exercise.id);
  }
  console.log(`Seed: ${exercisesData.length} exercises`);

  // ============================================================
  // 3. DEMO PROGRAM
  // ============================================================
  await prisma.program.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false },
  });

  const program = await prisma.program.create({
    data: {
      userId: user.id,
      name: 'Hypertrophy - Phase 1',
      description:
        'Upper / Lower / Full Body split, frequency 2x per muscle group per week. Hypertrophy phase (8 to 12 reps, RIR 2 to 3).',
      phase: 'Hypertrophy',
      isActive: true,
      startDate: new Date('2026-01-06'),
    },
  });
  console.log(`Seed: program -> ${program.name}`);

  // Compact definition of the 3 sessions.
  const workouts: Array<{
    name: string;
    dayOfWeek: number;
    order: number;
    exercises: Array<{
      name: string;
      targetSets: number;
      targetRepsMin: number;
      targetRepsMax: number;
      targetRIR: number;
      restSec: number;
      tempo?: string;
    }>;
  }> = [
    {
      name: 'Upper - Upper body',
      dayOfWeek: 1,
      order: 1,
      exercises: [
        { name: 'Pronated pull-ups (weighted if possible)', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '2-1-2-0' },
        { name: 'Incline dumbbell press (30 deg)', targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '3-0-1-0' },
        { name: 'Bent-over barbell row', targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '2-0-1-1' },
        { name: 'Seated dumbbell overhead press', targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 90, tempo: '2-0-1-0' },
        { name: 'Cable lateral raises', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 60, tempo: '1-1-3-0' },
        { name: 'EZ-bar curl', targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 75, tempo: '2-0-1-1' },
        { name: 'Machine dips or parallel bars', targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 75, tempo: '2-0-1-0' },
        { name: 'Cable crunch (kneeling)', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '2-2-2-0' },
      ],
    },
    {
      name: 'Lower - Lower body',
      dayOfWeek: 3,
      order: 2,
      exercises: [
        { name: 'Barbell hip thrust (or machine)', targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '1-1-1-0' },
        { name: 'Machine squat (or Hack squat)', targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 150, tempo: '3-0-1-0' },
        { name: 'Dumbbell Romanian Deadlift', targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '3-1-1-0' },
        { name: 'Leg extension', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 75, tempo: '1-1-2-0' },
        { name: 'Hip adduction machine', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '2-1-1-0' },
        { name: 'Standing calf raise (or machine)', targetSets: 4, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 60, tempo: '2-1-1-1' },
        { name: 'Hanging leg raises', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 60, tempo: '2-0-1-0' },
      ],
    },
    {
      name: 'Full Body - Upper-focused',
      dayOfWeek: 5,
      order: 3,
      exercises: [
        { name: 'Barbell bench press', targetSets: 4, targetRepsMin: 6, targetRepsMax: 8, targetRIR: 2, restSec: 150, tempo: '3-0-1-0' },
        { name: 'Pronated pull-ups (weighted if possible)', targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '2-1-2-0' },
        { name: 'Pec deck (or cable fly)', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 75, tempo: '1-1-2-1' },
        { name: 'Seated cable row (close handles)', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 90, tempo: '2-1-1-0' },
        { name: 'Cable lateral raises', targetSets: 4, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '1-1-3-0' },
        { name: 'Machine rear delt fly', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '1-1-2-1' },
        { name: 'Incline dumbbell curl (bench 60 deg)', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 75, tempo: '3-1-1-1' },
        { name: 'Triceps pushdown (rope)', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 60, tempo: '2-0-1-1' },
        { name: 'Seated calf raise machine', targetSets: 4, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '3-1-1-1' },
        { name: 'Cable crunch (kneeling)', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '2-2-2-0' },
      ],
    },
  ];

  let fullBodyWorkoutId = '';
  for (const w of workouts) {
    const workout = await prisma.workout.create({
      data: { programId: program.id, name: w.name, dayOfWeek: w.dayOfWeek, order: w.order },
    });
    if (w.order === 3) fullBodyWorkoutId = workout.id;
    let order = 1;
    for (const ex of w.exercises) {
      const exerciseId = exerciseMap.get(ex.name);
      if (!exerciseId) throw new Error(`Exercise not found: ${ex.name}`);
      await prisma.programExercise.create({
        data: {
          workoutId: workout.id,
          exerciseId,
          order: order++,
          targetSets: ex.targetSets,
          targetRepsMin: ex.targetRepsMin,
          targetRepsMax: ex.targetRepsMax,
          targetRIR: ex.targetRIR,
          restSec: ex.restSec,
          tempo: ex.tempo ?? null,
        },
      });
    }
    console.log(`Seed: workout "${w.name}" (${w.exercises.length} exercises)`);
  }

  // ============================================================
  // 4. SAMPLE SESSION (neutral data for the charts)
  // ============================================================
  const demoSession = await prisma.session.create({
    data: {
      userId: user.id,
      programId: program.id,
      workoutId: fullBodyWorkoutId,
      startedAt: new Date('2026-01-10T10:00:00'),
      finishedAt: new Date('2026-01-10T11:25:00'),
      notes: 'Sample session generated by the seed.',
    },
  });

  const setsData: Array<{
    exerciseName: string;
    setNumber: number;
    weight: number;
    reps: number;
    rir?: number;
    isDropSet?: boolean;
  }> = [
    { exerciseName: 'Barbell bench press', setNumber: 1, weight: 70, reps: 8, rir: 2 },
    { exerciseName: 'Barbell bench press', setNumber: 2, weight: 70, reps: 7, rir: 1 },
    { exerciseName: 'Barbell bench press', setNumber: 3, weight: 70, reps: 6, rir: 1 },
    { exerciseName: 'Pronated pull-ups (weighted if possible)', setNumber: 1, weight: 0, reps: 10, rir: 2 },
    { exerciseName: 'Pronated pull-ups (weighted if possible)', setNumber: 2, weight: 0, reps: 9, rir: 1 },
    { exerciseName: 'Pronated pull-ups (weighted if possible)', setNumber: 3, weight: 0, reps: 8, rir: 0 },
    { exerciseName: 'Pec deck (or cable fly)', setNumber: 1, weight: 60, reps: 12, rir: 2 },
    { exerciseName: 'Pec deck (or cable fly)', setNumber: 2, weight: 60, reps: 11, rir: 1 },
    { exerciseName: 'Seated cable row (close handles)', setNumber: 1, weight: 55, reps: 12, rir: 1 },
    { exerciseName: 'Seated cable row (close handles)', setNumber: 2, weight: 55, reps: 11, rir: 1 },
    { exerciseName: 'Cable lateral raises', setNumber: 1, weight: 6, reps: 14, rir: 2 },
    { exerciseName: 'Cable lateral raises', setNumber: 2, weight: 6, reps: 12, rir: 1 },
    { exerciseName: 'Incline dumbbell curl (bench 60 deg)', setNumber: 1, weight: 10, reps: 12, rir: 2 },
    { exerciseName: 'Incline dumbbell curl (bench 60 deg)', setNumber: 2, weight: 10, reps: 10, rir: 1 },
    { exerciseName: 'Triceps pushdown (rope)', setNumber: 1, weight: 18, reps: 12, rir: 1 },
    { exerciseName: 'Seated calf raise machine', setNumber: 1, weight: 55, reps: 15, rir: 1 },
    { exerciseName: 'Cable crunch (kneeling)', setNumber: 1, weight: 36, reps: 12, rir: 1 },
  ];

  for (const s of setsData) {
    const exerciseId = exerciseMap.get(s.exerciseName);
    if (!exerciseId) throw new Error(`Exercise not found: ${s.exerciseName}`);
    await prisma.set.create({
      data: {
        sessionId: demoSession.id,
        exerciseId,
        setNumber: s.setNumber,
        weight: s.weight,
        reps: s.reps,
        rir: s.rir,
        isDropSet: s.isDropSet ?? false,
      },
    });
  }
  console.log(`Seed: sample session (${setsData.length} sets)`);

  console.log('Seed: done.');
}

main()
  .catch((e) => {
    console.error('Seed: error', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
