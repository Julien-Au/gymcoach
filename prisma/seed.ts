/**
 * Demo seed for GymCoach (open-source edition).
 *
 * Loads a neutral dataset to help you explore the application:
 * - A demo account (email/password configurable via .env)
 * - The default exercise catalog (see lib/exercise-catalog.ts)
 * - A demo program "Hypertrophy - Phase 1" (Upper / Lower / Full Body)
 * - A sample session, so the charts and suggestions have data
 *
 * No personal data here: feel free to adapt the catalog and the program.
 *
 * Usage: npm run db:seed
 */

import { PrismaClient, Sex, TrainingGoal } from '@/prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { seedExerciseCatalog } from '../lib/exercise-catalog';

// Prisma 7 requires a driver adapter to connect (the Rust engine was removed).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

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
      displayName: 'Demo',
      bodyweight: 75,
      sex: Sex.MALE,
      heightCm: 178,
      goal: TrainingGoal.HYPERTROPHY,
      weeklyFrequency: 3,
    },
  });

  console.log(`Seed: demo account -> ${user.email}`);

  // ============================================================
  // 2. EXERCISE CATALOG (shared with the registration flow)
  // ============================================================
  const exerciseMap = await seedExerciseCatalog(prisma, user.id);
  console.log(`Seed: ${exerciseMap.size} exercises`);

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
