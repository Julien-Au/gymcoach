// Built-in program templates for established routines (issue #37).
//
// A template is just a curated `GeneratedProgram`: the exact same structured
// shape the AI program generator produces and the existing `/api/programs/build`
// route persists. This means templates materialize into a real `Program`
// through the same validated path, and the AI coach treats a template-derived
// program like any other user-authored program (it advises within it, it does
// not silently restructure it).
//
// Loading schemes (5/3/1 percentages, GZCLP stages, nSuns waves) are expressed
// here as set/rep/RIR targets plus explanatory notes, since GymCoach tracks
// sets/reps/RIR rather than a built-in percentage engine. The notes carry the
// "as written" intent so the user can run the program faithfully.

import {
  generatedProgramSchema,
  type GeneratedProgram,
} from '@/lib/schemas/program-generation';

export interface ProgramTemplate {
  // Stable slug used in URLs and the picker (e.g. "ppl-6day").
  slug: string;
  // Short display name.
  name: string;
  // One-line summary for the picker card.
  summary: string;
  // Attribution / how to run it as written.
  attribution: string;
  // The structured program, ready to POST to /api/programs/build.
  program: GeneratedProgram;
}

// 5/3/1 - basic 4-day (Wendler). Main lift per day at a working top set, plus
// Boring But Big style accessories. RIR/rep targets approximate the as-written
// intent; notes carry the percentage scheme.
const FIVE_THREE_ONE: ProgramTemplate = {
  slug: '531-bbb-4day',
  name: '5/3/1 (Boring But Big, 4-day)',
  summary: 'Wendler 5/3/1 main lifts with 5x10 BBB supplemental work, 4 days.',
  attribution:
    'Jim Wendler 5/3/1. Run the main lift off your training max (90% of 1RM): wave 5s/3s/1s week to week, last set AMRAP. Supplemental is 5x10 at ~50-60% TM.',
  program: {
    name: '5/3/1 Boring But Big',
    description:
      'Wendler 5/3/1 with Boring But Big supplemental volume. Set your training max to 90% of your 1RM and progress the TM, not the day-to-day load.',
    phase: 'Strength',
    workouts: [
      {
        name: 'Day 1 - Overhead Press',
        dayOfWeek: 1,
        exercises: [
          {
            name: 'Overhead Press',
            muscleGroup: 'SHOULDERS_FRONT',
            category: 'COMPOUND',
            targetSets: 3,
            targetRepsMin: 1,
            targetRepsMax: 5,
            targetRIR: 1,
            restSec: 180,
            notes: 'Main lift. 5/3/1 wave off training max; last set AMRAP.',
          },
          {
            name: 'Overhead Press',
            muscleGroup: 'SHOULDERS_FRONT',
            category: 'COMPOUND',
            targetSets: 5,
            targetRepsMin: 10,
            targetRepsMax: 10,
            targetRIR: 3,
            restSec: 90,
            notes: 'Boring But Big supplemental: 5x10 at ~50-60% TM.',
          },
          {
            name: 'Chin-up',
            muscleGroup: 'BACK_WIDTH',
            category: 'COMPOUND',
            targetSets: 5,
            targetRepsMin: 8,
            targetRepsMax: 12,
            targetRIR: 2,
            restSec: 90,
            notes: 'Pulling accessory to balance the pressing volume.',
          },
        ],
      },
      {
        name: 'Day 2 - Deadlift',
        dayOfWeek: 3,
        exercises: [
          {
            name: 'Deadlift',
            muscleGroup: 'BACK_THICKNESS',
            category: 'COMPOUND',
            targetSets: 3,
            targetRepsMin: 1,
            targetRepsMax: 5,
            targetRIR: 1,
            restSec: 240,
            notes: 'Main lift. 5/3/1 wave off training max; last set AMRAP.',
          },
          {
            name: 'Deadlift',
            muscleGroup: 'BACK_THICKNESS',
            category: 'COMPOUND',
            targetSets: 5,
            targetRepsMin: 10,
            targetRepsMax: 10,
            targetRIR: 3,
            restSec: 120,
            notes: 'Boring But Big supplemental: 5x10 at ~50-60% TM.',
          },
          {
            name: 'Hanging Leg Raise',
            muscleGroup: 'ABS',
            category: 'ISOLATION',
            targetSets: 4,
            targetRepsMin: 10,
            targetRepsMax: 15,
            targetRIR: 2,
            restSec: 60,
          },
        ],
      },
      {
        name: 'Day 3 - Bench Press',
        dayOfWeek: 5,
        exercises: [
          {
            name: 'Bench Press',
            muscleGroup: 'CHEST',
            category: 'COMPOUND',
            targetSets: 3,
            targetRepsMin: 1,
            targetRepsMax: 5,
            targetRIR: 1,
            restSec: 180,
            notes: 'Main lift. 5/3/1 wave off training max; last set AMRAP.',
          },
          {
            name: 'Bench Press',
            muscleGroup: 'CHEST',
            category: 'COMPOUND',
            targetSets: 5,
            targetRepsMin: 10,
            targetRepsMax: 10,
            targetRIR: 3,
            restSec: 90,
            notes: 'Boring But Big supplemental: 5x10 at ~50-60% TM.',
          },
          {
            name: 'Barbell Row',
            muscleGroup: 'BACK_THICKNESS',
            category: 'COMPOUND',
            targetSets: 5,
            targetRepsMin: 8,
            targetRepsMax: 12,
            targetRIR: 2,
            restSec: 90,
          },
        ],
      },
      {
        name: 'Day 4 - Squat',
        dayOfWeek: 6,
        exercises: [
          {
            name: 'Back Squat',
            muscleGroup: 'QUADS',
            category: 'COMPOUND',
            targetSets: 3,
            targetRepsMin: 1,
            targetRepsMax: 5,
            targetRIR: 1,
            restSec: 240,
            notes: 'Main lift. 5/3/1 wave off training max; last set AMRAP.',
          },
          {
            name: 'Back Squat',
            muscleGroup: 'QUADS',
            category: 'COMPOUND',
            targetSets: 5,
            targetRepsMin: 10,
            targetRepsMax: 10,
            targetRIR: 3,
            restSec: 120,
            notes: 'Boring But Big supplemental: 5x10 at ~50-60% TM.',
          },
          {
            name: 'Leg Curl',
            muscleGroup: 'HAMSTRINGS',
            category: 'ISOLATION',
            targetSets: 4,
            targetRepsMin: 10,
            targetRepsMax: 15,
            targetRIR: 2,
            restSec: 60,
          },
        ],
      },
    ],
  },
};

// GZCLP - Cody Lemon's linear-progression variant of GZCL. T1 main lift (5x3+),
// T2 secondary (3x10), T3 accessory (3x15+). 3 day rotation across 4 lifts.
const GZCLP: ProgramTemplate = {
  slug: 'gzclp-3day',
  name: 'GZCLP (linear progression)',
  summary: 'GZCL-based linear progression: T1 5x3, T2 3x10, T3 3x15+, 3 days.',
  attribution:
    'Cody Lemon GZCLP. T1: 5x3+ heavy, add weight each session, drop to 6x2 then 10x1 on a stall. T2: 3x10 (then 3x8, 3x6). T3: 3x15+ AMRAP last set, add weight when last set hits 25.',
  program: {
    name: 'GZCLP',
    description:
      'GZCL-based linear progression with T1 (main strength), T2 (secondary volume) and T3 (accessory) tiers. Add weight each session until you stall, then drop to the next rep scheme.',
    phase: 'Strength',
    workouts: [
      {
        name: 'Day A - Squat / Bench',
        dayOfWeek: 1,
        exercises: [
          {
            name: 'Back Squat',
            muscleGroup: 'QUADS',
            category: 'COMPOUND',
            targetSets: 5,
            targetRepsMin: 3,
            targetRepsMax: 3,
            targetRIR: 1,
            restSec: 180,
            notes: 'T1: 5x3+, last set AMRAP. Add weight each session.',
          },
          {
            name: 'Bench Press',
            muscleGroup: 'CHEST',
            category: 'COMPOUND',
            targetSets: 3,
            targetRepsMin: 10,
            targetRepsMax: 10,
            targetRIR: 2,
            restSec: 120,
            notes: 'T2: 3x10, then 3x8 then 3x6 on stalls.',
          },
          {
            name: 'Lat Pulldown',
            muscleGroup: 'BACK_WIDTH',
            category: 'COMPOUND',
            targetSets: 3,
            targetRepsMin: 15,
            targetRepsMax: 25,
            targetRIR: 2,
            restSec: 90,
            notes: 'T3: 3x15+, last set AMRAP. Add weight when last set hits 25.',
          },
        ],
      },
      {
        name: 'Day B - Overhead Press / Deadlift',
        dayOfWeek: 3,
        exercises: [
          {
            name: 'Overhead Press',
            muscleGroup: 'SHOULDERS_FRONT',
            category: 'COMPOUND',
            targetSets: 5,
            targetRepsMin: 3,
            targetRepsMax: 3,
            targetRIR: 1,
            restSec: 180,
            notes: 'T1: 5x3+, last set AMRAP. Add weight each session.',
          },
          {
            name: 'Deadlift',
            muscleGroup: 'BACK_THICKNESS',
            category: 'COMPOUND',
            targetSets: 3,
            targetRepsMin: 10,
            targetRepsMax: 10,
            targetRIR: 2,
            restSec: 150,
            notes: 'T2: 3x10, then 3x8 then 3x6 on stalls.',
          },
          {
            name: 'Dumbbell Row',
            muscleGroup: 'BACK_THICKNESS',
            category: 'COMPOUND',
            targetSets: 3,
            targetRepsMin: 15,
            targetRepsMax: 25,
            targetRIR: 2,
            restSec: 90,
            notes: 'T3: 3x15+, last set AMRAP.',
          },
        ],
      },
      {
        name: 'Day C - Bench / Squat',
        dayOfWeek: 5,
        exercises: [
          {
            name: 'Bench Press',
            muscleGroup: 'CHEST',
            category: 'COMPOUND',
            targetSets: 5,
            targetRepsMin: 3,
            targetRepsMax: 3,
            targetRIR: 1,
            restSec: 180,
            notes: 'T1: 5x3+, last set AMRAP. Add weight each session.',
          },
          {
            name: 'Back Squat',
            muscleGroup: 'QUADS',
            category: 'COMPOUND',
            targetSets: 3,
            targetRepsMin: 10,
            targetRepsMax: 10,
            targetRIR: 2,
            restSec: 120,
            notes: 'T2: 3x10, then 3x8 then 3x6 on stalls.',
          },
          {
            name: 'Cable Curl',
            muscleGroup: 'BICEPS',
            category: 'ISOLATION',
            targetSets: 3,
            targetRepsMin: 15,
            targetRepsMax: 25,
            targetRIR: 2,
            restSec: 60,
            notes: 'T3: 3x15+, last set AMRAP.',
          },
        ],
      },
    ],
  },
};

// Push / Pull / Legs - a 6-day hypertrophy split.
const PPL: ProgramTemplate = {
  slug: 'ppl-6day',
  name: 'Push / Pull / Legs (6-day)',
  summary: 'Classic 6-day PPL hypertrophy split, 8-12 rep work at 1-2 RIR.',
  attribution:
    'Standard Push/Pull/Legs run twice per week. Hypertrophy rep ranges (8-15), 1-2 RIR, progress load when you hit the top of the range across all sets.',
  program: {
    name: 'Push Pull Legs',
    description:
      'A 6-day Push/Pull/Legs hypertrophy split. Train each session twice per week; progress load when the top of the rep range is reached on all sets.',
    phase: 'Hypertrophy',
    workouts: [
      {
        name: 'Push A',
        dayOfWeek: 1,
        exercises: [
          { name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 150 },
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Incline Dumbbell Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 90 },
          { name: 'Lateral Raise', muscleGroup: 'SHOULDERS_LATERAL', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
          { name: 'Triceps Pushdown', muscleGroup: 'TRICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Pull A',
        dayOfWeek: 2,
        exercises: [
          { name: 'Deadlift', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 5, targetRepsMax: 8, targetRIR: 2, restSec: 180 },
          { name: 'Pull-up', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 4, targetRepsMin: 6, targetRepsMax: 12, targetRIR: 1, restSec: 120 },
          { name: 'Barbell Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Face Pull', muscleGroup: 'SHOULDERS_REAR', category: 'ISOLATION', targetSets: 3, targetRepsMin: 15, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
          { name: 'Barbell Curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Legs A',
        dayOfWeek: 3,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 180 },
          { name: 'Romanian Deadlift', muscleGroup: 'HAMSTRINGS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Leg Press', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 90 },
          { name: 'Leg Curl', muscleGroup: 'HAMSTRINGS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Standing Calf Raise', muscleGroup: 'CALVES', category: 'ISOLATION', targetSets: 4, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Push B',
        dayOfWeek: 4,
        exercises: [
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 150 },
          { name: 'Incline Dumbbell Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Cable Fly', muscleGroup: 'CHEST', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Lateral Raise', muscleGroup: 'SHOULDERS_LATERAL', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
          { name: 'Overhead Triceps Extension', muscleGroup: 'TRICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Pull B',
        dayOfWeek: 5,
        exercises: [
          { name: 'Lat Pulldown', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 120 },
          { name: 'Seated Cable Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Dumbbell Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 90 },
          { name: 'Rear Delt Fly', muscleGroup: 'SHOULDERS_REAR', category: 'ISOLATION', targetSets: 3, targetRepsMin: 15, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
          { name: 'Hammer Curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Legs B',
        dayOfWeek: 6,
        exercises: [
          { name: 'Front Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 180 },
          { name: 'Romanian Deadlift', muscleGroup: 'HAMSTRINGS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Bulgarian Split Squat', muscleGroup: 'GLUTES', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 90 },
          { name: 'Leg Extension', muscleGroup: 'QUADS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Seated Calf Raise', muscleGroup: 'CALVES', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
        ],
      },
    ],
  },
};

// Upper / Lower - a 4-day split.
const UPPER_LOWER: ProgramTemplate = {
  slug: 'upper-lower-4day',
  name: 'Upper / Lower (4-day)',
  summary: '4-day Upper/Lower split balancing strength and hypertrophy work.',
  attribution:
    'Standard 4-day Upper/Lower. Heavier compound work (5-8 reps) early in each session, hypertrophy accessories (8-15 reps) after, 1-2 RIR.',
  program: {
    name: 'Upper Lower',
    description:
      'A 4-day Upper/Lower split. Lead with a heavier compound, then accumulate hypertrophy volume on accessories. Progress load at the top of each rep range.',
    phase: 'Hypertrophy',
    workouts: [
      {
        name: 'Upper A',
        dayOfWeek: 1,
        exercises: [
          { name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 4, targetRepsMin: 5, targetRepsMax: 8, targetRIR: 1, restSec: 180 },
          { name: 'Barbell Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 150 },
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Lat Pulldown', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 90 },
          { name: 'Barbell Curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 60 },
          { name: 'Triceps Pushdown', muscleGroup: 'TRICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Lower A',
        dayOfWeek: 2,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 5, targetRepsMax: 8, targetRIR: 1, restSec: 180 },
          { name: 'Romanian Deadlift', muscleGroup: 'HAMSTRINGS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 150 },
          { name: 'Leg Press', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 90 },
          { name: 'Leg Curl', muscleGroup: 'HAMSTRINGS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Standing Calf Raise', muscleGroup: 'CALVES', category: 'ISOLATION', targetSets: 4, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Upper B',
        dayOfWeek: 4,
        exercises: [
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 4, targetRepsMin: 5, targetRepsMax: 8, targetRIR: 1, restSec: 180 },
          { name: 'Pull-up', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 150 },
          { name: 'Incline Dumbbell Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Seated Cable Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 90 },
          { name: 'Lateral Raise', muscleGroup: 'SHOULDERS_LATERAL', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
          { name: 'Hammer Curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Lower B',
        dayOfWeek: 5,
        exercises: [
          { name: 'Deadlift', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 4, targetRepsMax: 6, targetRIR: 2, restSec: 240 },
          { name: 'Front Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 150 },
          { name: 'Bulgarian Split Squat', muscleGroup: 'GLUTES', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 90 },
          { name: 'Leg Extension', muscleGroup: 'QUADS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Seated Calf Raise', muscleGroup: 'CALVES', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
        ],
      },
    ],
  },
};

// nSuns 4-day LP (531 variant). T1 main lift uses the nSuns 9-set wave; we
// express it as a single working block with notes carrying the wave intent.
const NSUNS: ProgramTemplate = {
  slug: 'nsuns-4day',
  name: 'nSuns 531 LP (4-day)',
  summary: 'nSuns 531 linear progression, 4 days, volume-heavy main-lift waves.',
  attribution:
    'nSuns 531 LP. The main lift runs a 9-set wave (e.g. 8/6/4/4/4/5/6/7/8+ reps at rising then falling %TM); the AMRAP on the key set drives the weekly TM increase. Express the wave by logging the prescribed reps each set.',
  program: {
    name: 'nSuns 531 LP',
    description:
      'nSuns 531 linear progression. Each main lift runs a 9-set intensity wave with an AMRAP set that decides the next weeks training-max bump. Run the prescribed reps per set as written.',
    phase: 'Strength',
    workouts: [
      {
        name: 'Day 1 - Bench / OHP',
        dayOfWeek: 1,
        exercises: [
          { name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 9, targetRepsMin: 1, targetRepsMax: 8, targetRIR: 1, restSec: 150, notes: 'nSuns T1 wave: 8/6/4/4/4/5/6/7/8+ reps; key set is AMRAP.' },
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 8, targetRepsMin: 4, targetRepsMax: 8, targetRIR: 2, restSec: 120, notes: 'nSuns T2 wave: 6/5/3/5/7/4/6/8 reps.' },
          { name: 'Chin-up', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 90 },
        ],
      },
      {
        name: 'Day 2 - Squat / Sumo Deadlift',
        dayOfWeek: 2,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 9, targetRepsMin: 1, targetRepsMax: 8, targetRIR: 1, restSec: 180, notes: 'nSuns T1 wave: 8/6/4/4/4/5/6/7/8+ reps; key set is AMRAP.' },
          { name: 'Deadlift', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 8, targetRepsMin: 3, targetRepsMax: 8, targetRIR: 2, restSec: 150, notes: 'nSuns T2 wave: 5/5/3/5/7/4/6/8 reps.' },
          { name: 'Leg Curl', muscleGroup: 'HAMSTRINGS', category: 'ISOLATION', targetSets: 4, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 2, restSec: 60 },
        ],
      },
      {
        name: 'Day 3 - OHP / Incline Bench',
        dayOfWeek: 4,
        exercises: [
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 9, targetRepsMin: 1, targetRepsMax: 8, targetRIR: 1, restSec: 150, notes: 'nSuns T1 wave: 8/6/4/4/4/5/6/7/8+ reps; key set is AMRAP.' },
          { name: 'Incline Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 8, targetRepsMin: 4, targetRepsMax: 8, targetRIR: 2, restSec: 120, notes: 'nSuns T2 wave: 6/5/3/5/7/4/6/8 reps.' },
          { name: 'Lateral Raise', muscleGroup: 'SHOULDERS_LATERAL', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Day 4 - Deadlift / Front Squat',
        dayOfWeek: 5,
        exercises: [
          { name: 'Deadlift', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 9, targetRepsMin: 1, targetRepsMax: 8, targetRIR: 1, restSec: 240, notes: 'nSuns T1 wave: 5/3/1/3/3/3/5/7/4+ reps; key set is AMRAP.' },
          { name: 'Front Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 8, targetRepsMin: 3, targetRepsMax: 8, targetRIR: 2, restSec: 150, notes: 'nSuns T2 wave: 5/5/3/5/7/4/6/8 reps.' },
          { name: 'Hanging Leg Raise', muscleGroup: 'ABS', category: 'ISOLATION', targetSets: 4, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 2, restSec: 60 },
        ],
      },
    ],
  },
};

// The public catalog. Validated at module load (see programTemplates) so a
// malformed template fails fast in tests and the build, never at runtime for a
// user.
const RAW_TEMPLATES: ProgramTemplate[] = [
  FIVE_THREE_ONE,
  GZCLP,
  PPL,
  UPPER_LOWER,
  NSUNS,
];

// Validate every template's program against the same schema the build route
// uses, so a typo here cannot produce a program the API would reject.
for (const t of RAW_TEMPLATES) {
  const result = generatedProgramSchema.safeParse(t.program);
  if (!result.success) {
    throw new Error(
      `Invalid built-in template "${t.slug}": ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
}

export const programTemplates: ProgramTemplate[] = RAW_TEMPLATES;

// Look up a template by slug.
export function getTemplateBySlug(slug: string): ProgramTemplate | undefined {
  return programTemplates.find((t) => t.slug === slug);
}
