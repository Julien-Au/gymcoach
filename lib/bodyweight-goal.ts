// Bodyweight goal (issue #398): where the trainee stands against a target
// bodyweight, and whether the trend is heading the right way. Pure, kg in and
// kg out; the card converts to the display unit at the edge.

// Within this distance of the goal it counts as reached, so a scale that
// wobbles by a few hundred grams around the target does not flicker.
export const GOAL_REACHED_TOLERANCE_KG = 0.25;

export type GoalDirection = 'lose' | 'gain';
export type GoalTone = 'good' | 'bad' | 'neutral';

export interface BodyweightGoalStatus {
  // Which way the latest weight still has to move to meet the goal.
  direction: GoalDirection;
  // Distance still to cover, always >= 0 (0 once reached).
  remainingKg: number;
  reached: boolean;
  // good: the distance to the goal shrank over the window (or the goal is
  // reached); bad: it grew; neutral: unchanged (or a single measurement).
  tone: GoalTone;
}

// `startKg` is the oldest measurement of the window, `currentKg` the latest.
// Everything is read from the distance to the goal, never from a direction
// inferred from the window start: the window start is not where the goal was
// set, so a bulk goal set after a cut (85 -> 75, goal 80) would otherwise read
// as a cut already reached. Reached means within the tolerance of the goal,
// on either side.
export function bodyweightGoalStatus(
  startKg: number,
  currentKg: number,
  goalKg: number,
): BodyweightGoalStatus {
  const distance = Math.abs(currentKg - goalKg);
  const reached = distance <= GOAL_REACHED_TOLERANCE_KG;
  const direction: GoalDirection = currentKg > goalKg ? 'lose' : 'gain';
  const startDistance = Math.abs(startKg - goalKg);
  const tone: GoalTone =
    reached || distance < startDistance ? 'good' : distance > startDistance ? 'bad' : 'neutral';
  return { direction, remainingKg: reached ? 0 : distance, reached, tone };
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
