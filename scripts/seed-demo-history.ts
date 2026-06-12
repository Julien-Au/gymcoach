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

  // The shipped feature surfaces the screenshots should show: a bodyweight
  // trend, a per-exercise goal in progress, and recent readiness check-ins.
  // Same clean-slate-then-recreate approach as the sessions above.
  await prisma.bodyweightEntry.deleteMany({ where: { userId: user.id } });
  const bodyweightEntries: { userId: string; weightKg: number; measuredAt: Date }[] = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const measuredAt = sessionDate(w, 1);
    if (measuredAt > now) continue;
    // Slow recomp trend: ~82.5 kg drifting down toward ~80 kg with noise.
    const weightKg = +(82.5 - (WEEKS - 1 - w) * 0.2 + (rng() - 0.5) * 0.6).toFixed(1);
    bodyweightEntries.push({ userId: user.id, weightKg, measuredAt });
  }
  await prisma.bodyweightEntry.createMany({ data: bodyweightEntries });
  const lastBodyweight = bodyweightEntries[bodyweightEntries.length - 1];
  if (lastBodyweight) {
    await prisma.user.update({
      where: { id: user.id },
      data: { bodyweight: lastBodyweight.weightKg },
    });
  }

  // One in-progress goal on the program's first compound lift.
  await prisma.exerciseGoal.deleteMany({ where: { userId: user.id } });
  const firstCompound = program.workouts
    .flatMap((w) => w.exercises)
    .find((pe) => pe.exercise.category === ExerciseCategory.COMPOUND && !pe.exercise.usesBodyweight);
  if (firstCompound) {
    const load = workingLoad(baseWeight(firstCompound.exercise), WEEKS - 1, firstCompound.exercise);
    await prisma.exerciseGoal.create({
      data: {
        userId: user.id,
        exerciseId: firstCompound.exercise.id,
        // A target a bit beyond the current working load: visibly in progress.
        targetWeight: round(load * 1.15, 2.5),
        targetReps: 5,
      },
    });
  }

  // A short run of readiness check-ins (the latest one recent enough to feed
  // auto-regulation and the coach payload).
  await prisma.readinessCheckin.deleteMany({ where: { userId: user.id } });
  const readinessData = [4, 3, 4, 4, 3].map((readiness, i) => ({
    userId: user.id,
    readiness,
    sleepQuality: Math.min(5, readiness + 1),
    createdAt: new Date(now.getTime() - i * 2 * 24 * 60 * 60 * 1000),
  }));
  await prisma.readinessCheckin.createMany({ data: readinessData });

  // Superset pairing (issue #146): pair the first workout's first two
  // strength exercises so the demo program and the session clip show the
  // A1/A2 flow.
  const firstWorkout = program.workouts[0];
  if (firstWorkout) {
    const pairables = firstWorkout.exercises
      .filter((pe) => pe.exercise.category !== ExerciseCategory.CARDIO)
      .slice(0, 2);
    if (pairables.length === 2) {
      await prisma.programExercise.updateMany({
        where: { id: { in: pairables.map((pe) => pe.id) } },
        data: { supersetGroup: 1 },
      });
      console.log(`Demo superset: paired ${pairables.map((pe) => pe.exercise.name).join(' + ')}.`);
    }
  }

  // Conditioning history (issue #133 batch): two cardio sessions per week so
  // the conditioning card and cardio rendering show up in the demo and the
  // screenshots. Deterministic like everything else.
  let cardio = await prisma.exercise.findFirst({
    where: { userId: user.id, category: ExerciseCategory.CARDIO },
    orderBy: { name: 'asc' },
  });
  if (!cardio) {
    cardio = await prisma.exercise.create({
      data: {
        userId: user.id,
        name: 'Running',
        muscleGroup: MuscleGroup.OTHER,
        category: ExerciseCategory.CARDIO,
      },
    });
  }
  let cardioSessions = 0;
  for (let w = WEEKS - 1; w >= 0; w--) {
    for (const day of [2, 6]) {
      const startedAt = sessionDate(w, day);
      if (startedAt > now) continue;
      // 25-40 min easy runs, pace drifting with the seeded RNG.
      const durationSec = Math.round((25 + rng() * 15) * 60);
      const distanceM = Math.round(durationSec * (2.6 + rng() * 0.5));
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          startedAt,
          finishedAt: new Date(startedAt.getTime() + durationSec * 1000),
        },
      });
      await prisma.set.create({
        data: {
          sessionId: session.id,
          exerciseId: cardio.id,
          setNumber: 1,
          weight: 0,
          reps: 1,
          durationSec,
          distanceM,
          completedAt: new Date(startedAt.getTime() + durationSec * 1000),
        },
      });
      cardioSessions += 1;
    }
  }

  console.log(
    `Demo extras: ${bodyweightEntries.length} bodyweight entries, ` +
      `${firstCompound ? 1 : 0} goal, ${readinessData.length} readiness check-ins, ` +
      `${cardioSessions} cardio sessions.`,
  );
}

main()
  .catch((e) => {
    console.error('seed:demo error', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
