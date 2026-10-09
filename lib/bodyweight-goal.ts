// Bodyweight goal (issue #398): where the trainee stands against a target
// bodyweight, and whether the trend is heading the right way. Pure, kg in and
// kg out; the card converts to the display unit at the edge.

// Within this distance of the goal it counts as reached, so a scale that
// wobbles by a few hundred grams around the target does not flicker.
export const GOAL_REACHED_TOLERANCE_KG = 0.25;

export type GoalDirection = 'lose' | 'gain';
export type GoalTone = 'good' | 'bad' | 'neutral';

export interface BodyweightGoalStatus {
  direction: GoalDirection;
  // Distance still to cover, always >= 0 (0 once reached).
  remainingKg: number;
  reached: boolean;
  // good: the trend moved toward the goal over the window; bad: away from it;
  // neutral: no movement yet (or a single measurement).
  tone: GoalTone;
}

// `startKg` is the oldest measurement of the window, `currentKg` the latest.
// The goal's direction is read against the start, so a cut stays a cut even
// after the trainee overshoots it: losing toward a lower goal is good, gaining
// toward a higher one is good, and the reverse is bad.
export function bodyweightGoalStatus(
  startKg: number,
  currentKg: number,
  goalKg: number,
): BodyweightGoalStatus {
  const direction: GoalDirection =
    goalKg < startKg || (goalKg === startKg && goalKg < currentKg) ? 'lose' : 'gain';
  const gap = direction === 'lose' ? currentKg - goalKg : goalKg - currentKg;
  const reached = gap <= GOAL_REACHED_TOLERANCE_KG;
  const change = currentKg - startKg;
  const towardGoal = direction === 'lose' ? change < 0 : change > 0;
  const awayFromGoal = direction === 'lose' ? change > 0 : change < 0;
  const tone: GoalTone = reached || towardGoal ? 'good' : awayFromGoal ? 'bad' : 'neutral';
  return { direction, remainingKg: reached ? 0 : gap, reached, tone };
}

// Y-axis bounds that keep the dashed goal line on the chart even when the goal
// sits outside the range of the logged weights (all in the display unit).
export function chartDomainWithGoal(
  values: number[],
  goal: number | null,
): [number, number] | null {
  if (goal == null || values.length === 0) return null;
  const low = Math.min(goal, ...values);
  const high = Math.max(goal, ...values);
  return [Math.floor(low - 1), Math.ceil(high + 1)];
}
