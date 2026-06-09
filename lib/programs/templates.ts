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

// Starting Strength - Mark Rippetoe's novice barbell program. Two alternating
// full-body days (A/B), 3x5 on the main lifts, deadlift 1x5, add weight every
// session. Power clean is run as a back/thickness pull here.
const STARTING_STRENGTH: ProgramTemplate = {
  slug: 'starting-strength-3day',
  name: 'Starting Strength (3x5 A/B)',
  summary: 'Rippetoe novice linear progression: two full-body days, 3x5, add weight every session.',
  attribution:
    'Mark Rippetoe Starting Strength. Alternate workout A and B across 3 sessions per week. Squat every session 3x5; add 2.5-5 kg each time you complete all reps. Deadlift is 1x5. Reset 10% on a stall.',
  program: {
    name: 'Starting Strength',
    description:
      'Rippetoe novice barbell linear progression. Two alternating full-body workouts, three sessions per week. Squat 3x5 every session and add a small jump whenever all prescribed reps are completed.',
    phase: 'Strength',
    workouts: [
      {
        name: 'Workout A - Squat / Bench / Deadlift',
        dayOfWeek: 1,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 240, notes: '3x5. Add 2.5-5 kg every session you complete all reps.' },
          { name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 3, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 180, notes: '3x5. Add weight every session you complete all reps.' },
          { name: 'Deadlift', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 1, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 240, notes: '1x5 working set. Add weight every session.' },
        ],
      },
      {
        name: 'Workout B - Squat / Press / Power Clean',
        dayOfWeek: 3,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 240, notes: '3x5. Add 2.5-5 kg every session you complete all reps.' },
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 3, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 180, notes: '3x5. Add weight every session you complete all reps.' },
          { name: 'Power Clean', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 5, targetRepsMin: 3, targetRepsMax: 3, targetRIR: 2, restSec: 180, notes: '5x3 explosive pulls. Beginners may substitute barbell rows.' },
        ],
      },
    ],
  },
};

// StrongLifts 5x5 - two alternating workouts (A/B), 5x5 on the main lifts,
// deadlift 1x5, add weight every session. A simpler high-volume novice LP.
const STRONGLIFTS: ProgramTemplate = {
  slug: 'stronglifts-5x5-3day',
  name: 'StrongLifts 5x5 (A/B)',
  summary: 'Two alternating full-body workouts, 5x5 main lifts, add weight every session.',
  attribution:
    'StrongLifts 5x5 by Mehdi. Alternate workout A and B across 3 sessions per week. 5x5 on squat, bench, press and row; deadlift 1x5. Add 2.5 kg each session; deload 10% after three failed attempts.',
  program: {
    name: 'StrongLifts 5x5',
    description:
      'Two alternating full-body workouts run three times per week. 5x5 on the main lifts (deadlift 1x5). Add a small jump every session and deload 10% after stalling three times.',
    phase: 'Strength',
    workouts: [
      {
        name: 'Workout A - Squat / Bench / Row',
        dayOfWeek: 1,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 5, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 240, notes: '5x5. Add 2.5 kg every session you complete all reps.' },
          { name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 5, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 180, notes: '5x5. Add weight every session you complete all reps.' },
          { name: 'Barbell Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 5, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 180, notes: '5x5. Add weight every session you complete all reps.' },
        ],
      },
      {
        name: 'Workout B - Squat / Press / Deadlift',
        dayOfWeek: 3,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 5, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 240, notes: '5x5. Add 2.5 kg every session you complete all reps.' },
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 5, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 180, notes: '5x5. Add weight every session you complete all reps.' },
          { name: 'Deadlift', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 1, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 240, notes: '1x5 working set. Add weight every session.' },
        ],
      },
    ],
  },
};

// Madcow 5x5 - intermediate weekly ramping 5x5. Monday heavy ramp to a top 5,
// Wednesday light, Friday ramp to a new top triple/PR. Weekly progression.
const MADCOW: ProgramTemplate = {
  slug: 'madcow-5x5-3day',
  name: 'Madcow 5x5 (intermediate)',
  summary: 'Weekly ramping 5x5: heavy Monday top set, light Wednesday, Friday PR triple.',
  attribution:
    'Madcow 5x5 intermediate program. Monday ramps in 5 sets to a top set of 5; Wednesday is lighter recovery volume; Friday ramps to a heavy top set then a back-off. Progress the load week to week, not session to session.',
  program: {
    name: 'Madcow 5x5',
    description:
      'Intermediate weekly-progression 5x5. Ramp across sets to a heavy top set on Monday, take a lighter Wednesday, and hit a new top set on Friday. Add weight week over week rather than every session.',
    phase: 'Strength',
    workouts: [
      {
        name: 'Monday - Heavy Ramp',
        dayOfWeek: 1,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 5, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 240, notes: 'Ramp 5 sets to a top set of 5. Top set sits near 1-2 RIR.' },
          { name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 5, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 180, notes: 'Ramp 5 sets to a top set of 5.' },
          { name: 'Barbell Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 5, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 1, restSec: 180, notes: 'Ramp 5 sets to a top set of 5.' },
        ],
      },
      {
        name: 'Wednesday - Light',
        dayOfWeek: 3,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 3, restSec: 180, notes: 'Lighter recovery volume; ramp to Mondays 3rd set load.' },
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 4, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 3, restSec: 150, notes: 'Lighter recovery volume.' },
          { name: 'Deadlift', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 5, targetRepsMax: 5, targetRIR: 2, restSec: 180, notes: 'Lighter ramp; save the heavy pull for the weekly progression.' },
        ],
      },
      {
        name: 'Friday - Top Set / PR',
        dayOfWeek: 5,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 0, restSec: 240, notes: 'Ramp to a heavy top set of 3 (PR set), then one back-off set of 8.' },
          { name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 0, restSec: 180, notes: 'Ramp to a heavy top set of 3 (PR set), then a back-off set.' },
          { name: 'Barbell Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 1, restSec: 180, notes: 'Ramp to a heavy top set, then a back-off set.' },
        ],
      },
    ],
  },
};

// PHUL - Power Hypertrophy Upper Lower. 4 days: two power days (lower reps,
// heavier) and two hypertrophy days (higher reps).
const PHUL: ProgramTemplate = {
  slug: 'phul-4day',
  name: 'PHUL (Power Hypertrophy Upper Lower)',
  summary: '4-day upper/lower mixing two heavy power days with two higher-rep hypertrophy days.',
  attribution:
    'PHUL (Power Hypertrophy Upper Lower). Two power days (3-5 reps on main lifts) and two hypertrophy days (8-15 reps). Progress load on the power days; chase volume and the rep range on the hypertrophy days.',
  program: {
    name: 'PHUL',
    description:
      'Power Hypertrophy Upper Lower. Two heavier power days build strength on the main lifts (3-5 reps) and two hypertrophy days accumulate volume (8-15 reps). Four sessions per week.',
    phase: 'Hypertrophy',
    workouts: [
      {
        name: 'Upper Power',
        dayOfWeek: 1,
        exercises: [
          { name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 1, restSec: 180 },
          { name: 'Barbell Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 1, restSec: 180 },
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 3, targetRepsMin: 5, targetRepsMax: 8, targetRIR: 2, restSec: 150 },
          { name: 'Lat Pulldown', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 2, restSec: 120 },
          { name: 'Barbell Curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 60 },
          { name: 'Triceps Pushdown', muscleGroup: 'TRICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Lower Power',
        dayOfWeek: 2,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 1, restSec: 240 },
          { name: 'Deadlift', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 1, restSec: 240 },
          { name: 'Leg Press', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Leg Curl', muscleGroup: 'HAMSTRINGS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 60 },
          { name: 'Standing Calf Raise', muscleGroup: 'CALVES', category: 'ISOLATION', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Upper Hypertrophy',
        dayOfWeek: 4,
        exercises: [
          { name: 'Incline Dumbbell Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 120 },
          { name: 'Seated Cable Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 120 },
          { name: 'Cable Fly', muscleGroup: 'CHEST', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Lateral Raise', muscleGroup: 'SHOULDERS_LATERAL', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
          { name: 'Hammer Curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Overhead Triceps Extension', muscleGroup: 'TRICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Lower Hypertrophy',
        dayOfWeek: 5,
        exercises: [
          { name: 'Front Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 150 },
          { name: 'Romanian Deadlift', muscleGroup: 'HAMSTRINGS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 120 },
          { name: 'Leg Extension', muscleGroup: 'QUADS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Leg Curl', muscleGroup: 'HAMSTRINGS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Seated Calf Raise', muscleGroup: 'CALVES', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
        ],
      },
    ],
  },
};

// PHAT - Power Hypertrophy Adaptive Training (Layne Norton). 5 days: two power
// days (upper/lower) and three hypertrophy days (back/shoulders, lower, chest/arms).
const PHAT: ProgramTemplate = {
  slug: 'phat-5day',
  name: 'PHAT (Power Hypertrophy Adaptive Training)',
  summary: 'Layne Norton 5-day split: two power days plus three high-volume hypertrophy days.',
  attribution:
    'PHAT by Layne Norton. Two power days train the main lifts in the 3-5 rep range; three hypertrophy days train the same patterns lighter for 8-20 reps. Five sessions per week, high overall volume.',
  program: {
    name: 'PHAT',
    description:
      'Power Hypertrophy Adaptive Training (Layne Norton). Two power days (3-5 reps) drive strength and three hypertrophy days (8-20 reps) drive volume across upper and lower body. Five sessions per week.',
    phase: 'Hypertrophy',
    workouts: [
      {
        name: 'Upper Power',
        dayOfWeek: 1,
        exercises: [
          { name: 'Barbell Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 1, restSec: 180 },
          { name: 'Pull-up', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 3, targetRepsMin: 6, targetRepsMax: 8, targetRIR: 2, restSec: 150 },
          { name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 1, restSec: 180 },
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 3, targetRepsMin: 6, targetRepsMax: 8, targetRIR: 2, restSec: 150 },
          { name: 'Barbell Curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 60 },
          { name: 'Skullcrusher', muscleGroup: 'TRICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Lower Power',
        dayOfWeek: 2,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 1, restSec: 240 },
          { name: 'Deadlift', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 3, targetRepsMax: 5, targetRIR: 1, restSec: 240 },
          { name: 'Leg Press', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRIR: 2, restSec: 120 },
          { name: 'Leg Curl', muscleGroup: 'HAMSTRINGS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 60 },
          { name: 'Standing Calf Raise', muscleGroup: 'CALVES', category: 'ISOLATION', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Back / Shoulders Hypertrophy',
        dayOfWeek: 4,
        exercises: [
          { name: 'Seated Cable Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 120 },
          { name: 'Lat Pulldown', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 90 },
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 90 },
          { name: 'Lateral Raise', muscleGroup: 'SHOULDERS_LATERAL', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
          { name: 'Rear Delt Fly', muscleGroup: 'SHOULDERS_REAR', category: 'ISOLATION', targetSets: 3, targetRepsMin: 15, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Lower Hypertrophy',
        dayOfWeek: 5,
        exercises: [
          { name: 'Front Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 150 },
          { name: 'Romanian Deadlift', muscleGroup: 'HAMSTRINGS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 120 },
          { name: 'Leg Extension', muscleGroup: 'QUADS', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
          { name: 'Leg Curl', muscleGroup: 'HAMSTRINGS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Seated Calf Raise', muscleGroup: 'CALVES', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Chest / Arms Hypertrophy',
        dayOfWeek: 6,
        exercises: [
          { name: 'Incline Dumbbell Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 1, restSec: 120 },
          { name: 'Cable Fly', muscleGroup: 'CHEST', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Hammer Curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 4, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Cable Curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Overhead Triceps Extension', muscleGroup: 'TRICEPS', category: 'ISOLATION', targetSets: 4, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
          { name: 'Triceps Pushdown', muscleGroup: 'TRICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
    ],
  },
};

// Full Body 3x/week - a beginner-friendly full-body template, three sessions
// with rotating emphasis, moderate volume and rep ranges.
const FULL_BODY_3X: ProgramTemplate = {
  slug: 'full-body-3day',
  name: 'Full Body 3x/week (beginner)',
  summary: 'Beginner-friendly full-body program, three sessions per week, moderate volume.',
  attribution:
    'Generic beginner full-body, three non-consecutive days per week. Each session hits the whole body with one main compound per pattern plus an accessory. Add weight when you reach the top of the rep range on all sets.',
  program: {
    name: 'Full Body 3x',
    description:
      'A beginner-friendly full-body program run three non-consecutive days per week. Each day covers a squat, a hinge/pull, a press and an accessory, in the 6-15 rep range. Progress load at the top of each range.',
    phase: 'General',
    workouts: [
      {
        name: 'Full Body A',
        dayOfWeek: 1,
        exercises: [
          { name: 'Back Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 2, restSec: 180 },
          { name: 'Bench Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 2, restSec: 150 },
          { name: 'Barbell Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Lateral Raise', muscleGroup: 'SHOULDERS_LATERAL', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Full Body B',
        dayOfWeek: 3,
        exercises: [
          { name: 'Deadlift', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 5, targetRepsMax: 8, targetRIR: 2, restSec: 180 },
          { name: 'Overhead Press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 2, restSec: 150 },
          { name: 'Lat Pulldown', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Leg Curl', muscleGroup: 'HAMSTRINGS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
        ],
      },
      {
        name: 'Full Body C',
        dayOfWeek: 5,
        exercises: [
          { name: 'Front Squat', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 2, restSec: 180 },
          { name: 'Incline Dumbbell Press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Seated Cable Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
          { name: 'Barbell Curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
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
  STARTING_STRENGTH,
  STRONGLIFTS,
  MADCOW,
  PHUL,
  PHAT,
  FULL_BODY_3X,
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
