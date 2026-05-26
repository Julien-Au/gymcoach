/**
 * Seed de démo pour GymCoach (édition open-source).
 *
 * Charge un jeu de données neutre permettant de découvrir l'application :
 * - Un compte de démo (email/mot de passe configurables via .env)
 * - Un catalogue d'exercices avec muscleGroup, category et repères techniques
 * - Un programme de démo "Hypertrophie - Phase 1" (Upper / Lower / Full Body)
 * - Une séance d'exemple, pour que les graphiques et suggestions aient des données
 *
 * Aucune donnée personnelle ici : adaptez librement le catalogue et le programme.
 *
 * Usage : npm run db:seed
 */

import { PrismaClient, MuscleGroup, ExerciseCategory } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed: démarrage...');

  // ============================================================
  // 1. COMPTE DE DÉMO
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

  console.log(`Seed: compte de démo -> ${user.email}`);

  // ============================================================
  // 2. CATALOGUE D'EXERCICES (repères techniques génériques)
  // ============================================================
  const exercisesData = [
    // Pectoraux
    {
      name: 'Développé couché barre',
      muscleGroup: MuscleGroup.CHEST,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 150,
      notes: 'Barre dans le creux de la paume, poignet aligné avec l\'avant-bras. Coudes à 45 degrés du buste. Toucher la poitrine.',
    },
    {
      name: 'Développé incliné haltères (30°)',
      muscleGroup: MuscleGroup.CHEST,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 120,
      notes: 'Banc à 30 degrés. Tempo 3-0-1-0. Ne pas verrouiller les coudes en haut. Focus pectoral supérieur.',
    },
    {
      name: 'Pec deck (ou butterfly poulies)',
      muscleGroup: MuscleGroup.CHEST,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 75,
      notes: 'Coudes 5 à 10 degrés sous la ligne des épaules. Conduit par les coudes. Pause en étirement et en contraction.',
    },

    // Dos
    {
      name: 'Tractions pronation (lestées si possible)',
      muscleGroup: MuscleGroup.BACK_WIDTH,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 120,
      usesBodyweight: true,
      notes: 'Pronation, largeur épaules + 10 cm. Tempo strict. Tirer avec les coudes vers les hanches. Lester quand 4x10 est atteint.',
    },
    {
      name: 'Tirage poulie haute (prise large)',
      muscleGroup: MuscleGroup.BACK_WIDTH,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 120,
      notes: 'Prise large pronation. Tirer aux clavicules, omoplates basses. Buste légèrement penché.',
    },
    {
      name: 'Rowing barre buste penché',
      muscleGroup: MuscleGroup.BACK_THICKNESS,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 120,
      notes: 'Buste 30 à 45 degrés, dos plat. Tirer vers le nombril. Coudes le long du corps.',
    },
    {
      name: 'Tirage horizontal poulie (poignées étroites)',
      muscleGroup: MuscleGroup.BACK_THICKNESS,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 90,
      notes: 'Poignées parallèles. Tirer vers le nombril. Squeeze des omoplates. Coudes le long du corps.',
    },

    // Épaules
    {
      name: 'Développé militaire haltères assis',
      muscleGroup: MuscleGroup.SHOULDERS_FRONT,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 120,
      notes: 'Banc à 90 degrés avec dossier. Pas de cambrure lombaire. Descente jusqu\'aux oreilles.',
    },
    {
      name: 'Élévations latérales poulie',
      muscleGroup: MuscleGroup.SHOULDERS_LATERAL,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 60,
      notes: 'Câble devant le corps. Coude légèrement fléchi. Mener par le coude. Stop à hauteur épaule. Descente lente.',
    },
    {
      name: 'Oiseau machine (rear delt fly)',
      muscleGroup: MuscleGroup.SHOULDERS_REAR,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 60,
      notes: 'Pec deck inversé. Conduit par les coudes vers l\'arrière. Paumes face au sol. Squeeze 1s.',
    },

    // Biceps
    {
      name: 'Curl barre EZ',
      muscleGroup: MuscleGroup.BICEPS,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 75,
      notes: 'Pas de balancement. Squeeze 1s en haut. Coudes près du corps.',
    },
    {
      name: 'Curl incliné haltères (banc 60°)',
      muscleGroup: MuscleGroup.BICEPS,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 75,
      notes: 'Banc à 60 degrés. Coudes en arrière du buste, fixes. Supination en montant. Étirement complet en bas (Maeo 2021).',
    },

    // Triceps
    {
      name: 'Dips machine ou barres parallèles',
      muscleGroup: MuscleGroup.TRICEPS,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 75,
      usesBodyweight: true,
      notes: 'Buste vertical pour focus triceps. Sur machine assistée, saisir le poids d\'assistance en négatif.',
    },
    {
      name: 'Extension triceps poulie (corde)',
      muscleGroup: MuscleGroup.TRICEPS,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 60,
      notes: 'Coudes collés au corps. Écarter la corde en bas. Ne pas verrouiller le coude brutalement (95% extension max).',
    },

    // Quadriceps
    {
      name: 'Squat machine (ou Hack squat)',
      muscleGroup: MuscleGroup.QUADS,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 150,
      notes: 'Profondeur cuisses parallèles. Descente contrôlée 3s.',
    },
    {
      name: 'Leg extension',
      muscleGroup: MuscleGroup.QUADS,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 75,
      notes: 'Pause 1s en haut. Pieds neutres.',
    },
    {
      name: 'Fentes marchées avec haltères',
      muscleGroup: MuscleGroup.QUADS,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 90,
      notes: 'Genou à 1 cm du sol, pas de rebond.',
    },

    // Ischios
    {
      name: 'Romanian Deadlift haltères',
      muscleGroup: MuscleGroup.HAMSTRINGS,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 120,
      notes: 'Pousser les hanches en arrière, dos plat. Genoux légèrement fléchis. Étirement ischios maximal.',
    },
    {
      name: 'Leg curl assis',
      muscleGroup: MuscleGroup.HAMSTRINGS,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 75,
      notes: 'Pause 1s en contraction. Amplitude complète.',
    },

    // Fessiers
    {
      name: 'Hip thrust barre (ou machine)',
      muscleGroup: MuscleGroup.GLUTES,
      category: ExerciseCategory.COMPOUND,
      defaultRestSec: 120,
      notes: 'Pause 1s en haut, neutralité cervicale. Verrouiller les fessiers en haut.',
    },

    // Adducteurs
    {
      name: 'Adducteurs machine',
      muscleGroup: MuscleGroup.QUADS, // approximation, pas de groupe dédié
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 60,
      notes: 'Pause 1s en contraction.',
    },

    // Mollets
    {
      name: 'Mollets debout (ou machine)',
      muscleGroup: MuscleGroup.CALVES,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 60,
      notes: 'Gastrocnémien (jambes tendues). Amplitude max, pause 1s en bas. Pas de rebond.',
    },
    {
      name: 'Mollets assis machine',
      muscleGroup: MuscleGroup.CALVES,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 60,
      notes: 'Soléaire (jambes pliées 90 degrés). Pause en étirement bas. Tempo 3-1-1-1. Pas de rebond.',
    },

    // Abdos
    {
      name: 'Crunch poulie haute (à genoux)',
      muscleGroup: MuscleGroup.ABS,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 60,
      notes: 'Hanches verrouillées. Enrouler la colonne. Approcher les côtes du bassin.',
    },
    {
      name: 'Relevés jambes suspendu',
      muscleGroup: MuscleGroup.ABS,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 60,
      usesBodyweight: true,
      notes: 'Contrôle 2s à la descente. Pas de balancement.',
    },
    {
      name: 'Gainage planche + side plank',
      muscleGroup: MuscleGroup.ABS,
      category: ExerciseCategory.ISOLATION,
      defaultRestSec: 45,
      usesBodyweight: true,
      notes: 'Stabilité du tronc. 1 tour en finisher.',
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
  console.log(`Seed: ${exercisesData.length} exercices`);

  // ============================================================
  // 3. PROGRAMME DE DÉMO
  // ============================================================
  await prisma.program.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false },
  });

  const program = await prisma.program.create({
    data: {
      userId: user.id,
      name: 'Hypertrophie - Phase 1',
      description:
        'Split Upper / Lower / Full Body, fréquence 2x par groupe musculaire et par semaine. Phase hypertrophie (8 à 12 reps, RIR 2 à 3).',
      phase: 'Hypertrophie',
      isActive: true,
      startDate: new Date('2026-01-06'),
    },
  });
  console.log(`Seed: programme -> ${program.name}`);

  // Définition compacte des 3 séances.
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
      name: 'Upper - Haut du corps',
      dayOfWeek: 1,
      order: 1,
      exercises: [
        { name: 'Tractions pronation (lestées si possible)', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '2-1-2-0' },
        { name: 'Développé incliné haltères (30°)', targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '3-0-1-0' },
        { name: 'Rowing barre buste penché', targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '2-0-1-1' },
        { name: 'Développé militaire haltères assis', targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 90, tempo: '2-0-1-0' },
        { name: 'Élévations latérales poulie', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 60, tempo: '1-1-3-0' },
        { name: 'Curl barre EZ', targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 75, tempo: '2-0-1-1' },
        { name: 'Dips machine ou barres parallèles', targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 75, tempo: '2-0-1-0' },
        { name: 'Crunch poulie haute (à genoux)', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '2-2-2-0' },
      ],
    },
    {
      name: 'Lower - Bas du corps',
      dayOfWeek: 3,
      order: 2,
      exercises: [
        { name: 'Hip thrust barre (ou machine)', targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '1-1-1-0' },
        { name: 'Squat machine (ou Hack squat)', targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 150, tempo: '3-0-1-0' },
        { name: 'Romanian Deadlift haltères', targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '3-1-1-0' },
        { name: 'Leg extension', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 75, tempo: '1-1-2-0' },
        { name: 'Adducteurs machine', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '2-1-1-0' },
        { name: 'Mollets debout (ou machine)', targetSets: 4, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 60, tempo: '2-1-1-1' },
        { name: 'Relevés jambes suspendu', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 60, tempo: '2-0-1-0' },
      ],
    },
    {
      name: 'Full Body - Orienté haut',
      dayOfWeek: 5,
      order: 3,
      exercises: [
        { name: 'Développé couché barre', targetSets: 4, targetRepsMin: 6, targetRepsMax: 8, targetRIR: 2, restSec: 150, tempo: '3-0-1-0' },
        { name: 'Tractions pronation (lestées si possible)', targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120, tempo: '2-1-2-0' },
        { name: 'Pec deck (ou butterfly poulies)', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 75, tempo: '1-1-2-1' },
        { name: 'Tirage horizontal poulie (poignées étroites)', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 90, tempo: '2-1-1-0' },
        { name: 'Élévations latérales poulie', targetSets: 4, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '1-1-3-0' },
        { name: 'Oiseau machine (rear delt fly)', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '1-1-2-1' },
        { name: 'Curl incliné haltères (banc 60°)', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 75, tempo: '3-1-1-1' },
        { name: 'Extension triceps poulie (corde)', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 60, tempo: '2-0-1-1' },
        { name: 'Mollets assis machine', targetSets: 4, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '3-1-1-1' },
        { name: 'Crunch poulie haute (à genoux)', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60, tempo: '2-2-2-0' },
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
      if (!exerciseId) throw new Error(`Exercice introuvable : ${ex.name}`);
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
    console.log(`Seed: workout "${w.name}" (${w.exercises.length} exercices)`);
  }

  // ============================================================
  // 4. SÉANCE D'EXEMPLE (données neutres pour les graphiques)
  // ============================================================
  const demoSession = await prisma.session.create({
    data: {
      userId: user.id,
      programId: program.id,
      workoutId: fullBodyWorkoutId,
      startedAt: new Date('2026-01-10T10:00:00'),
      finishedAt: new Date('2026-01-10T11:25:00'),
      notes: 'Séance d\'exemple générée par le seed.',
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
    { exerciseName: 'Développé couché barre', setNumber: 1, weight: 70, reps: 8, rir: 2 },
    { exerciseName: 'Développé couché barre', setNumber: 2, weight: 70, reps: 7, rir: 1 },
    { exerciseName: 'Développé couché barre', setNumber: 3, weight: 70, reps: 6, rir: 1 },
    { exerciseName: 'Tractions pronation (lestées si possible)', setNumber: 1, weight: 0, reps: 10, rir: 2 },
    { exerciseName: 'Tractions pronation (lestées si possible)', setNumber: 2, weight: 0, reps: 9, rir: 1 },
    { exerciseName: 'Tractions pronation (lestées si possible)', setNumber: 3, weight: 0, reps: 8, rir: 0 },
    { exerciseName: 'Pec deck (ou butterfly poulies)', setNumber: 1, weight: 60, reps: 12, rir: 2 },
    { exerciseName: 'Pec deck (ou butterfly poulies)', setNumber: 2, weight: 60, reps: 11, rir: 1 },
    { exerciseName: 'Tirage horizontal poulie (poignées étroites)', setNumber: 1, weight: 55, reps: 12, rir: 1 },
    { exerciseName: 'Tirage horizontal poulie (poignées étroites)', setNumber: 2, weight: 55, reps: 11, rir: 1 },
    { exerciseName: 'Élévations latérales poulie', setNumber: 1, weight: 6, reps: 14, rir: 2 },
    { exerciseName: 'Élévations latérales poulie', setNumber: 2, weight: 6, reps: 12, rir: 1 },
    { exerciseName: 'Curl incliné haltères (banc 60°)', setNumber: 1, weight: 10, reps: 12, rir: 2 },
    { exerciseName: 'Curl incliné haltères (banc 60°)', setNumber: 2, weight: 10, reps: 10, rir: 1 },
    { exerciseName: 'Extension triceps poulie (corde)', setNumber: 1, weight: 18, reps: 12, rir: 1 },
    { exerciseName: 'Mollets assis machine', setNumber: 1, weight: 55, reps: 15, rir: 1 },
    { exerciseName: 'Crunch poulie haute (à genoux)', setNumber: 1, weight: 36, reps: 12, rir: 1 },
  ];

  for (const s of setsData) {
    const exerciseId = exerciseMap.get(s.exerciseName);
    if (!exerciseId) throw new Error(`Exercice introuvable : ${s.exerciseName}`);
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
  console.log(`Seed: séance d'exemple (${setsData.length} séries)`);

  console.log('Seed: terminé.');
}

main()
  .catch((e) => {
    console.error('Seed: erreur', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
