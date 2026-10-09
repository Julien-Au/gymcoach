import { describe, expect, it } from 'vitest';
import { bodyweightGoalStatus, chartDomainWithGoal } from '@/lib/bodyweight-goal';

describe('bodyweightGoalStatus (issue #398)', () => {
  describe('a lower goal (a cut)', () => {
    it('is good when the weight went down toward the goal', () => {
      expect(bodyweightGoalStatus(85, 83, 78)).toEqual({
        direction: 'lose',
        remainingKg: 5,
        reached: false,
        tone: 'good',
      });
    });

    it('is bad when the weight went up, away from the goal', () => {
      expect(bodyweightGoalStatus(85, 86, 78)).toMatchObject({
        direction: 'lose',
        remainingKg: 8,
        tone: 'bad',
      });
    });

    it('is reached once at or below the goal, overshoot included', () => {
      expect(bodyweightGoalStatus(85, 78.1, 78)).toMatchObject({ reached: true, tone: 'good' });
      expect(bodyweightGoalStatus(85, 76, 78)).toMatchObject({
        reached: true,
        remainingKg: 0,
        tone: 'good',
      });
    });
  });

  describe('a higher goal (a bulk)', () => {
    it('is good when the weight went up toward the goal', () => {
      expect(bodyweightGoalStatus(70, 72, 76)).toEqual({
        direction: 'gain',
        remainingKg: 4,
        reached: false,
        tone: 'good',
      });
    });

    it('is bad when the weight went down, away from the goal', () => {
      expect(bodyweightGoalStatus(70, 69, 76)).toMatchObject({
        direction: 'gain',
        remainingKg: 7,
        tone: 'bad',
      });
    });

    it('is reached once at or above the goal', () => {
      expect(bodyweightGoalStatus(70, 77, 76)).toMatchObject({ reached: true, remainingKg: 0 });
    });
  });

  it('is neutral with no movement yet (a single measurement)', () => {
    expect(bodyweightGoalStatus(80, 80, 75)).toMatchObject({ direction: 'lose', tone: 'neutral' });
    expect(bodyweightGoalStatus(80, 80, 85)).toMatchObject({ direction: 'gain', tone: 'neutral' });
  });

  it('reads the direction against the current weight when the goal equals the start', () => {
    // Started on the goal and drifted up: getting back down is the job.
    expect(bodyweightGoalStatus(80, 82, 80)).toMatchObject({
      direction: 'lose',
      remainingKg: 2,
      tone: 'bad',
    });
  });
});

describe('chartDomainWithGoal', () => {
  it('widens the axis so a goal below the data stays visible', () => {
    expect(chartDomainWithGoal([82.4, 83.1], 75)).toEqual([74, 85]);
  });

  it('widens the axis so a goal above the data stays visible', () => {
    expect(chartDomainWithGoal([70.2, 71], 76.5)).toEqual([69, 78]);
  });

  it('leaves the default axis alone without a goal or data', () => {
    expect(chartDomainWithGoal([80], null)).toBeNull();
    expect(chartDomainWithGoal([], 80)).toBeNull();
  });
});
