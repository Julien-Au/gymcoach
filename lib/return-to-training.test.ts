import { describe, expect, it } from 'vitest';
import {
  calculateReturnRecommendation,
  RETURN_EXTENDED_GAP_DAYS,
  RETURN_MODERATE_GAP_DAYS,
  type ReturnProgramExercise,
  type ReturnHistorySession,
  type ReturnTrainingHistory,
} from '@/lib/return-to-training';

const now = new Date('2026-07-12T12:00:00.000Z');
const programExercise: ReturnProgramExercise = {
  exerciseId: 'incline-dumbbell-press',
  targetSets: 4,
  targetRepsMin: 8,
  targetRIR: 2,
  exercise: {
    category: 'COMPOUND',
    equipmentType: 'DUMBBELL',
    usesBodyweight: false,
  },
};

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

function sessions(weight = 20) {
  return [1, 2, 3].map((index) => ({
    sessionId: `session-${index}`,
    performedAt: daysAgo(50 + index * 7),
    sets: [{ weight, reps: 10, rir: 2, isDropSet: false }],
  }));
}

function historySessions(
  entries: Array<{ days: number; weight: number; reps?: number; rir?: number | null }>,
): ReturnHistorySession[] {
  return entries.map((entry, index) => ({
    sessionId: `history-${index}`,
    performedAt: daysAgo(entry.days),
    sets: [
      {
        weight: entry.weight,
        reps: entry.reps ?? 8,
        rir: entry.rir === undefined ? 2 : entry.rir,
        isDropSet: false,
      },
    ],
  }));
}

function history(overrides: Partial<ReturnTrainingHistory> = {}): ReturnTrainingHistory {
  return {
    exerciseLastPerformedAt: daysAgo(60),
    muscleLastPerformedAt: daysAgo(5),
    recentMuscleSets: 12,
    baselineMuscleSetsPer28Days: 12,
    exerciseSessions: sessions(),
    ...overrides,
  };
}

const olympDumbbells = {
  equipmentType: 'DUMBBELL' as const,
  dumbbellWeights: [10, 12, 14, 15, 16, 19],
};

describe('return-to-training recommendations', () => {
  it('does not infer detraining when a user has no history at all', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history({
        exerciseLastPerformedAt: null,
        muscleLastPerformedAt: null,
        recentMuscleSets: 0,
        baselineMuscleSetsPer28Days: 0,
        exerciseSessions: [],
      }),
      now,
      loadConstraints: olympDumbbells,
    });

    expect(result).toMatchObject({
      mode: 'normal',
      targetSets: 4,
      targetRIR: 2,
      calibrationRequired: false,
    });
  });

  it('keeps normal programming when the exercise gap is not over six weeks', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history({ exerciseLastPerformedAt: daysAgo(42) }),
      now,
      loadConstraints: olympDumbbells,
    });

    expect(result).toMatchObject({
      mode: 'normal',
      targetSets: 4,
      targetRIR: 2,
      calibrationRequired: false,
      suggestedWeight: null,
    });
  });

  it('recalibrates a stale exercise while preserving maintained-muscle volume', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history({ exerciseLastPerformedAt: daysAgo(60) }),
      now,
      loadConstraints: olympDumbbells,
    });

    expect(result).toMatchObject({
      mode: 'exercise-reintro',
      exerciseGapDays: 60,
      muscleMaintained: true,
      targetSets: 2,
      targetRIR: 3,
      weightCeiling: 19,
      suggestedWeight: 16,
      calibrationRequired: true,
      historySessionCount: 3,
    });
  });

  it('uses a broader reduction when the primary muscle also had a long break', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history({ muscleLastPerformedAt: daysAgo(60), recentMuscleSets: 0 }),
      now,
      loadConstraints: olympDumbbells,
    });

    expect(result).toMatchObject({
      mode: 'muscle-reintro',
      muscleGapDays: 60,
      muscleMaintained: false,
      targetSets: 1,
      targetRIR: 4,
      weightCeiling: 19,
      suggestedWeight: 15,
    });
  });

  it('keeps normal upstream programming for a new movement with no exercise history', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history({ exerciseLastPerformedAt: null, exerciseSessions: [] }),
      now,
      loadConstraints: olympDumbbells,
    });

    expect(result).toMatchObject({
      mode: 'normal',
      muscleMaintained: true,
      targetSets: 4,
      targetRIR: 2,
      weightCeiling: null,
      calibrationRequired: false,
      suggestedWeight: null,
    });
  });

  it('treats sharply reduced recent muscle volume as not maintained', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history({ recentMuscleSets: 2, baselineMuscleSetsPer28Days: 8 }),
      now,
      loadConstraints: olympDumbbells,
    });

    expect(result).toMatchObject({
      mode: 'exercise-reintro',
      muscleMaintained: false,
      recentVolumeRatio: 0.25,
      targetSets: 1,
      targetRIR: 4,
      suggestedWeight: 15,
    });
  });

  it('does not suggest a load for equipment marked unavailable in the selected gym', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history(),
      now,
      loadConstraints: { ...olympDumbbells, isAvailable: false },
    });

    expect(result.suggestedWeight).toBeNull();
    expect(result.weightCeiling).toBeNull();
  });

  it('uses current bodyweight when recalibrating added load', () => {
    const bodyweightExercise: ReturnProgramExercise = {
      ...programExercise,
      exerciseId: 'pull-up',
      exercise: {
        category: 'COMPOUND',
        equipmentType: 'BODYWEIGHT',
        usesBodyweight: true,
      },
    };
    const result = calculateReturnRecommendation({
      programExercise: bodyweightExercise,
      history: history({ exerciseSessions: sessions(0) }),
      now,
      bodyweight: 80,
    });

    expect(result.mode).toBe('exercise-reintro');
    expect(result.suggestedWeight).toBe(0);
    expect(result.weightCeiling).toBe(0);
  });

  it('keeps one recent exact session eligible and bounded by robust long-term history', () => {
    const bench: ReturnProgramExercise = {
      ...programExercise,
      exerciseId: 'bench-press',
      exercise: { ...programExercise.exercise, equipmentType: 'BARBELL' },
    };
    const loadConstraints = {
      equipmentType: 'BARBELL' as const,
      barWeights: [20],
      plateWeights: [1.25, 2.5, 5, 10, 20],
    };
    const result = calculateReturnRecommendation({
      programExercise: bench,
      history: history({
        exerciseLastPerformedAt: daysAgo(3),
        exerciseSessions: historySessions([
          { days: 3, weight: 80 },
          { days: 90, weight: 60 },
          { days: 100, weight: 70 },
          { days: 110, weight: 80 },
        ]),
      }),
      now,
      loadConstraints,
    });

    expect(result).toMatchObject({
      mode: 'exercise-reintro',
      exerciseGapDays: 3,
      returnGapDays: 87,
      recentHistorySessionCount: 1,
      longTermHistorySessionCount: 3,
      historyBasis: 'recent-and-long-term',
      confidence: 'low',
      startFraction: 0.8,
      suggestedWeight: 60,
    });
    expect(result.suggestedWeight).toBeGreaterThan(20);
  });

  it('uses old exact-exercise history instead of collapsing a 60-80 kg bench to 20 kg', () => {
    const result = calculateReturnRecommendation({
      programExercise: {
        ...programExercise,
        exerciseId: 'bench-press',
        exercise: { ...programExercise.exercise, equipmentType: 'BARBELL' },
      },
      history: history({
        exerciseLastPerformedAt: daysAgo(180),
        muscleLastPerformedAt: daysAgo(5),
        exerciseSessions: historySessions([
          { days: 180, weight: 60 },
          { days: 210, weight: 70 },
          { days: 240, weight: 80 },
        ]),
      }),
      now,
      loadConstraints: {
        equipmentType: 'BARBELL',
        barWeights: [20],
        plateWeights: [1.25, 2.5, 5, 10, 20],
      },
    });

    expect(result).toMatchObject({
      mode: 'exercise-reintro',
      historyBasis: 'long-term-exact',
      longTermHistorySessionCount: 3,
      startFraction: 0.75,
      suggestedWeight: 50,
    });
  });

  it('keeps the 6, 12 and 24 week gap bands bounded and monotonic', () => {
    const fineLoads = {
      equipmentType: 'DUMBBELL' as const,
      dumbbellWeights: Array.from({ length: 100 }, (_, index) => index + 1),
    };
    const recommendationAt = (gapDays: number) =>
      calculateReturnRecommendation({
        programExercise,
        history: history({
          exerciseLastPerformedAt: daysAgo(gapDays),
          exerciseSessions: historySessions([
            { days: gapDays, weight: 40 },
            { days: gapDays + 14, weight: 42 },
            { days: gapDays + 28, weight: 44 },
          ]),
        }),
        now,
        loadConstraints: fineLoads,
      });
    const sixWeeks = recommendationAt(43);
    const twelveWeeks = recommendationAt(RETURN_MODERATE_GAP_DAYS);
    const twentyFourWeeks = recommendationAt(RETURN_EXTENDED_GAP_DAYS);

    expect(sixWeeks.startFraction).toBe(0.85);
    expect(twelveWeeks.startFraction).toBe(0.8);
    expect(twentyFourWeeks.startFraction).toBe(0.75);
    expect(sixWeeks.suggestedWeight).toBeGreaterThanOrEqual(twelveWeeks.suggestedWeight!);
    expect(twelveWeeks.suggestedWeight).toBeGreaterThanOrEqual(twentyFourWeeks.suggestedWeight!);
  });

  it('makes broad muscle return fractions and confidence more conservative across gap bands', () => {
    const fineLoads = {
      equipmentType: 'DUMBBELL' as const,
      dumbbellWeights: Array.from({ length: 100 }, (_, index) => index + 1),
    };
    const recommendationAt = (gapDays: number) =>
      calculateReturnRecommendation({
        programExercise,
        history: history({
          exerciseLastPerformedAt: daysAgo(gapDays),
          muscleLastPerformedAt: daysAgo(gapDays),
          recentMuscleSets: 0,
          baselineMuscleSetsPer28Days: 12,
          exerciseSessions: historySessions([
            { days: gapDays, weight: 40 },
            { days: gapDays + 14, weight: 42 },
            { days: gapDays + 28, weight: 44 },
          ]),
        }),
        now,
        loadConstraints: fineLoads,
      });
    const sixWeeks = recommendationAt(43);
    const twelveWeeks = recommendationAt(RETURN_MODERATE_GAP_DAYS);
    const twentyFourWeeks = recommendationAt(RETURN_EXTENDED_GAP_DAYS);

    expect(sixWeeks.startFraction).toBe(0.75);
    expect(twelveWeeks.startFraction).toBe(0.7);
    expect(twentyFourWeeks.startFraction).toBe(0.65);
    expect(sixWeeks.confidence).toBe('medium');
    expect(twelveWeeks.confidence).toBe('low');
    expect(twentyFourWeeks.confidence).toBe('low');
    expect(sixWeeks.suggestedWeight).toBeGreaterThan(twelveWeeks.suggestedWeight!);
    expect(twelveWeeks.suggestedWeight).toBeGreaterThan(twentyFourWeeks.suggestedWeight!);
  });

  it('bounds a recent PR outlier and a recent weak outlier against older exact history', () => {
    const calculate = (recentWeight: number) =>
      calculateReturnRecommendation({
        programExercise,
        history: history({
          exerciseLastPerformedAt: daysAgo(3),
          exerciseSessions: historySessions([
            { days: 3, weight: recentWeight },
            { days: 90, weight: 38 },
            { days: 100, weight: 40 },
            { days: 110, weight: 42 },
          ]),
        }),
        now,
        loadConstraints: {
          equipmentType: 'DUMBBELL',
          dumbbellWeights: Array.from({ length: 100 }, (_, index) => index + 1),
        },
      });
    const highOutlier = calculate(200);
    const weakOutlier = calculate(5);

    expect(highOutlier.suggestedWeight).toBeLessThan(60);
    expect(weakOutlier.suggestedWeight).toBeGreaterThan(20);
  });

  it('uses an agreeing sparse older sample only as confirmation of the recent anchor', () => {
    const calculate = (olderWeights: number[]) =>
      calculateReturnRecommendation({
        programExercise,
        history: history({
          exerciseLastPerformedAt: daysAgo(3),
          exerciseSessions: historySessions([
            { days: 3, weight: 40 },
            ...olderWeights.map((weight, index) => ({ days: 90 + index * 10, weight })),
          ]),
        }),
        now,
        loadConstraints: {
          equipmentType: 'DUMBBELL',
          dumbbellWeights: Array.from({ length: 100 }, (_, index) => index + 1),
        },
      });
    const oneOlder = calculate([40]);
    const twoOlder = calculate([38, 42]);

    expect(oneOlder).toMatchObject({
      recentHistorySessionCount: 1,
      longTermHistorySessionCount: 1,
      historyBasis: 'recent-and-long-term',
    });
    expect(oneOlder.weightCeiling).not.toBeNull();
    expect(oneOlder.suggestedWeight).toBeGreaterThan(1);
    expect(twoOlder.weightCeiling).toBe(oneOlder.weightCeiling);
    expect(twoOlder.suggestedWeight).toBe(oneOlder.suggestedWeight);
  });

  it.each([
    { label: 'old PR', recentWeight: 40, olderWeights: [200] },
    { label: 'old weak record', recentWeight: 40, olderWeights: [5] },
    { label: 'recent PR', recentWeight: 200, olderWeights: [40] },
    { label: 'recent weak record', recentWeight: 5, olderWeights: [40] },
    { label: 'two older records with a PR', recentWeight: 40, olderWeights: [40, 200] },
    { label: 'two older records with a weak outlier', recentWeight: 40, olderWeights: [40, 5] },
  ])(
    'uses equipment-floor calibration for conflicting sparse history: $label',
    ({ recentWeight, olderWeights }) => {
      const result = calculateReturnRecommendation({
        programExercise,
        history: history({
          exerciseLastPerformedAt: daysAgo(3),
          exerciseSessions: historySessions([
            { days: 3, weight: recentWeight },
            ...olderWeights.map((weight, index) => ({ days: 90 + index * 10, weight })),
          ]),
        }),
        now,
        loadConstraints: {
          equipmentType: 'DUMBBELL',
          dumbbellWeights: Array.from({ length: 100 }, (_, index) => index + 1),
        },
      });

      expect(result).toMatchObject({
        historyBasis: 'recent-and-long-term',
        confidence: 'low',
        weightCeiling: null,
        suggestedWeight: 1,
      });
    },
  );

  it.each([{ olderWeights: [40] }, { olderWeights: [40, 42] }])(
    'keeps sparse older-only exact history eligible at low confidence: $olderWeights',
    ({ olderWeights }) => {
      const result = calculateReturnRecommendation({
        programExercise,
        history: history({
          exerciseLastPerformedAt: daysAgo(90),
          exerciseSessions: historySessions(
            olderWeights.map((weight, index) => ({ days: 90 + index * 10, weight })),
          ),
        }),
        now,
        loadConstraints: {
          equipmentType: 'DUMBBELL',
          dumbbellWeights: Array.from({ length: 100 }, (_, index) => index + 1),
        },
      });

      expect(result).toMatchObject({
        historyBasis: 'long-term-exact',
        recentHistorySessionCount: 0,
        longTermHistorySessionCount: olderWeights.length,
        confidence: 'low',
      });
      expect(result.weightCeiling).not.toBeNull();
      expect(result.suggestedWeight).toBeGreaterThan(1);
    },
  );

  it('keeps very old weak novice records as context without letting them dominate the anchor', () => {
    const established = [60, 70, 80, 90, 100, 110, 120, 130].map((days, index) => ({
      days,
      weight: 38 + index,
    }));
    const calculate = (entries: Array<{ days: number; weight: number }>) =>
      calculateReturnRecommendation({
        programExercise,
        history: history({
          exerciseLastPerformedAt: daysAgo(60),
          exerciseSessions: historySessions(entries),
        }),
        now,
        loadConstraints: {
          equipmentType: 'DUMBBELL',
          dumbbellWeights: Array.from({ length: 100 }, (_, index) => index + 1),
        },
      });
    const establishedOnly = calculate(established);
    const withOldNoviceRecords = calculate([
      ...established,
      { days: 1_000, weight: 5 },
      { days: 1_100, weight: 7 },
    ]);

    expect(withOldNoviceRecords.historySessionCount).toBe(10);
    expect(withOldNoviceRecords.suggestedWeight).toBe(establishedOnly.suggestedWeight);
  });

  it('preserves a bounded floor from an older established block after eight weak return sessions', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history({
        exerciseLastPerformedAt: daysAgo(60),
        exerciseSessions: historySessions([
          ...Array.from({ length: 8 }, (_, index) => ({
            days: 60 + index * 7,
            weight: 20,
          })),
          { days: 200, weight: 60 },
          { days: 210, weight: 70 },
          { days: 220, weight: 80 },
        ]),
      }),
      now,
      loadConstraints: {
        equipmentType: 'DUMBBELL',
        dumbbellWeights: Array.from({ length: 100 }, (_, index) => index + 1),
      },
    });

    expect(result.historySessionCount).toBe(11);
    expect(result.suggestedWeight).toBeGreaterThan(20);
  });

  it('lowers confidence when RIR is missing without discarding the exact history', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history({
        exerciseSessions: historySessions([
          { days: 60, weight: 20, rir: null },
          { days: 70, weight: 22, rir: null },
          { days: 80, weight: 24, rir: null },
        ]),
      }),
      now,
      loadConstraints: olympDumbbells,
    });

    expect(result).toMatchObject({
      historySessionCount: 3,
      historyBasis: 'long-term-exact',
      confidence: 'low',
    });
    expect(result.suggestedWeight).not.toBeNull();
  });

  it('never uses non-comparable equipment sessions as an exact load anchor', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history({
        exerciseLastPerformedAt: null,
        exerciseSessions: [],
        nonComparableExerciseSessions: 4,
      }),
      now,
      loadConstraints: olympDumbbells,
    });

    expect(result).toMatchObject({
      historyBasis: 'none',
      confidence: 'low',
      nonComparableHistorySessionCount: 4,
      weightCeiling: null,
      suggestedWeight: null,
    });
  });

  it('returns identical output for identical long-history input', () => {
    const input = {
      programExercise,
      history: history({
        exerciseLastPerformedAt: daysAgo(90),
        exerciseSessions: historySessions([
          { days: 90, weight: 20 },
          { days: 100, weight: 22 },
          { days: 110, weight: 24 },
        ]),
      }),
      now,
      loadConstraints: olympDumbbells,
    };

    expect(calculateReturnRecommendation(input)).toEqual(calculateReturnRecommendation(input));
  });

  it('uses the lightest attainable non-bodyweight load when the calculated ceiling is lower', () => {
    const result = calculateReturnRecommendation({
      programExercise,
      history: history({
        exerciseLastPerformedAt: daysAgo(180),
        exerciseSessions: historySessions([
          { days: 180, weight: 2 },
          { days: 200, weight: 3 },
          { days: 220, weight: 4 },
        ]),
      }),
      now,
      loadConstraints: {
        equipmentType: 'DUMBBELL',
        dumbbellWeights: [10, 12, 14],
      },
    });

    expect(result).toMatchObject({ weightCeiling: 10, suggestedWeight: 10 });
  });
});
