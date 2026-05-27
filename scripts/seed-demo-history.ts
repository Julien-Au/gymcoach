/**
 * Demo history generator (for screenshots / the README, not for real users).
 *
 * Generates ~12 weeks of realistic training sessions for the demo account so
 * the progress charts and weekly-volume views look populated. Deterministic
 * (seeded RNG) so the charts are reproducible.
 *
 * Prerequisite: run `npm run db:seed` first (creates the demo user, the
 * exercise catalog and the active program). Then:
 *   DATABASE_URL=... npm run seed:demo
 *
 * It replaces the demo user's existing sessions to stay reproducible.
 */
import { PrismaClient, MuscleGroup, ExerciseCategory } from '@prisma/client';

const prisma = new PrismaClient();
const WEEKS = 12;

// Deterministic RNG so the generated charts are stable across runs.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(1337);

function round(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// Rough starting working weight (kg) by muscle group + category. For
// bodyweight exercises this is the added load (starts at 0).
function baseWeight(ex: {
  muscleGroup: MuscleGroup;
  category: ExerciseCategory;
  usesBodyweight: boolean;
}): number {
  if (ex.usesBodyweight) return 0;
  const compound: Partial<Record<MuscleGroup, number>> = {
    CHEST: 60,
    BACK_WIDTH: 55,
    BACK_THICKNESS: 60,
    SHOULDERS_FRONT: 30,
    QUADS: 70,
    HAMSTRINGS: 50,
    GLUTES: 70,
  };
  const isolation: Partial<Record<MuscleGroup, number>> = {
    CHEST: 55,
    SHOULDERS_LATERAL: 7,
    SHOULDERS_REAR: 40,
    BICEPS: 22,
    TRICEPS: 20,
    QUADS: 55,
    HAMSTRINGS: 45,
    CALVES: 55,
    ABS: 32,
  };
  const table = ex.category === ExerciseCategory.COMPOUND ? compound : isolation;
  return table[ex.muscleGroup] ?? (ex.category === ExerciseCategory.COMPOUND ? 50 : 25);
}

// Working load for a given week, ramping up with a small deload around week 7.
function workingLoad(
  base: number,
  weeksElapsed: number,
  ex: { category: ExerciseCategory; usesBodyweight: boolean },
): number {
  const stepKg = ex.usesBodyweight
    ? 2.5
    : ex.category === ExerciseCategory.COMPOUND
      ? 2.5
      : 1;
  // ~one increment every 1.6 weeks, with noise.
  let increments = Math.floor(weeksElapsed / 1.6 + rng() * 0.6);
  if (weeksElapsed >= 7) increments -= 1; // light deload week 7 onward bump
  const raw = base + Math.max(0, increments) * stepKg;
  const step = ex.usesBodyweight || ex.category === ExerciseCategory.ISOLATION ? 1 : 2.5;
  return round(Math.max(ex.usesBodyweight ? 0 : step, raw), step);
}

function repsFor(setNumber: number, min: number, max: number): number {
  // Slightly fewer reps on later sets (fatigue), within the target range.
  const top = max - Math.floor(rng() * 1.5);
  const reps = top - (setNumber - 1);
  return Math.max(min, Math.min(max, reps));
}

function rirFor(target: number, setNumber: number): number {
  const r = target - (setNumber >= 3 ? 1 : 0) + (rng() < 0.3 ? 1 : 0);
  return Math.max(0, Math.min(5, r));
}

function sessionDate(weeksAgo: number, dayOfWeek: number): Date {
  const d = new Date();
  d.setHours(18, 30, 0, 0);
  const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon .. 7=Sun
  d.setDate(d.getDate() - (dow - 1)); // Monday of the current week
  d.setDate(d.getDate() - weeksAgo * 7 + (dayOfWeek - 1));
  return d;
}

async function main() {
  const email = process.env.USER_EMAIL || 'you@example.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Demo user not found. Run `npm run db:seed` first.');

  const program = await prisma.program.findFirst({
    where: { userId: user.id, isActive: true },
    include: {
      workouts: {
        orderBy: { order: 'asc' },
        include: {
          exercises: {
            orderBy: { order: 'asc' },
            include: { exercise: true },
          },
        },
      },
    },
  });
  if (!program) throw new Error('No active program. Run `npm run db:seed` first.');

  // Clean slate for reproducibility (demo user only).
  await prisma.session.deleteMany({ where: { userId: user.id } });

  const now = new Date();
  let sessionCount = 0;
  let setCount = 0;

  for (let w = WEEKS - 1; w >= 0; w--) {
    const weeksElapsed = WEEKS - 1 - w;
    for (const workout of program.workouts) {
      const day = workout.dayOfWeek ?? workout.order;
      const startedAt = sessionDate(w, day);
      if (startedAt > now) continue; // skip future days in the current week

      const session = await prisma.session.create({
        data: {
          userId: user.id,
          programId: program.id,
          workoutId: workout.id,
          startedAt,
          finishedAt: new Date(startedAt.getTime() + 75 * 60 * 1000),
        },
      });
      sessionCount += 1;

      const sets: {
        sessionId: string;
        exerciseId: string;
        setNumber: number;
        weight: number;
        reps: number;
        rir: number;
        completedAt: Date;
      }[] = [];

      for (const pe of workout.exercises) {
        const ex = pe.exercise;
        const load = workingLoad(baseWeight(ex), weeksElapsed, ex);
        for (let s = 1; s <= pe.targetSets; s++) {
          sets.push({
            sessionId: session.id,
            exerciseId: ex.id,
            setNumber: s,
            weight: load,
            reps: repsFor(s, pe.targetRepsMin, pe.targetRepsMax),
            rir: rirFor(pe.targetRIR, s),
            completedAt: new Date(startedAt.getTime() + (pe.order * 5 + s) * 60 * 1000),
          });
        }
      }
      await prisma.set.createMany({ data: sets });
      setCount += sets.length;
    }
  }

  console.log(`Demo history: ${sessionCount} sessions, ${setCount} sets over ${WEEKS} weeks.`);
}

main()
  .catch((e) => {
    console.error('seed:demo error', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
