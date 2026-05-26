import type { Set } from '@prisma/client';

// ============================================================
// Training stats - volume, estimated 1RM, weekly aggregation
// ============================================================

// ============================================================
// Bodyweight: effective tonnage on bodyweight exercises
// ============================================================

// Effective load of a set: for `usesBodyweight` exercises, we add the user's
// bodyweight. `setWeight` remains the entered value (added load, or negative
// for assistance). If the user has not filled in their bodyweight, we return
// setWeight as-is (backward-safe).
export function effectiveWeight(
  setWeight: number,
  exerciseUsesBodyweight: boolean,
  bodyweight: number | null | undefined,
): number {
  if (exerciseUsesBodyweight && bodyweight && bodyweight > 0) {
    return +(bodyweight + setWeight).toFixed(2);
  }
  return setWeight;
}

// Enriches a list of sets with their effective load. The sets must be
// decorated beforehand with `usesBodyweight` (typically copied from
// `set.exercise.usesBodyweight` in the Server Component). We avoid mutating,
// returning a new list instead.
export function applyBodyweight<
  T extends { weight: number; usesBodyweight?: boolean | null },
>(sets: T[], bodyweight: number | null | undefined): T[] {
  if (!bodyweight || bodyweight <= 0) return sets;
  return sets.map((s) =>
    s.usesBodyweight ? { ...s, weight: +(bodyweight + s.weight).toFixed(2) } : s,
  );
}

// Volume of a set = load × reps. For bodyweight (weight = 0),
// we return 0 by convention (impossible to compare with a load).
export function setVolume(set: Pick<Set, 'weight' | 'reps' | 'isWarmup'>): number {
  if (set.isWarmup) return 0;
  return set.weight * set.reps;
}

// Total volume of a list of sets (sum, excluding warmups).
export function totalVolume(sets: Pick<Set, 'weight' | 'reps' | 'isWarmup'>[]): number {
  return sets.reduce((acc, s) => acc + setVolume(s), 0);
}

// Estimated 1RM via the Epley formula: weight × (1 + reps / 30).
// Returns 0 for sets at 0 kg (bodyweight not comparable).
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

// Best estimated 1RM over a list of sets (warmups and drop sets included
// since they are technically valid for estimating strength).
export function best1RM(sets: Pick<Set, 'weight' | 'reps' | 'isWarmup'>[]): number {
  let best = 0;
  for (const s of sets) {
    if (s.isWarmup) continue;
    const e = estimate1RM(s.weight, s.reps);
    if (e > best) best = e;
  }
  return best;
}

// ============================================================
// ISO week (Monday-Sunday) - key YYYY-Www, label "W{w} YYYY"
// ============================================================

// Returns the ISO key of a date in the "YYYY-Www" format (week starting Monday).
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday of the current week (ISO: the week belongs to the year its Thursday falls in).
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Date of the Monday (00:00 UTC) of the ISO week containing the given date.
export function isoWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dayNum - 1));
  return d;
}

// ============================================================
// Aggregations
// ============================================================

export interface ExerciseChartPoint {
  date: string; // ISO date (YYYY-MM-DD) of the session
  sessionStartedAt: Date;
  maxWeight: number;
  topSetReps: number; // reps of the best set (max weight)
  estimated1RM: number;
  totalVolume: number;
}

// For an exercise, aggregates each session into a progression point.
// Input: sets ordered by session, with sessionStartedAt joined.
export function exerciseProgress(
  sets: (Pick<Set, 'weight' | 'reps' | 'isWarmup'> & { sessionId: string; sessionStartedAt: Date })[],
): ExerciseChartPoint[] {
  const bySession = new Map<
    string,
    { startedAt: Date; sets: typeof sets }
  >();
  for (const s of sets) {
    if (s.isWarmup) continue;
    const entry = bySession.get(s.sessionId);
    if (entry) {
      entry.sets.push(s);
    } else {
      bySession.set(s.sessionId, { startedAt: s.sessionStartedAt, sets: [s] });
    }
  }
  const points: ExerciseChartPoint[] = [];
  for (const [, { startedAt, sets: sessionSets }] of bySession) {
    if (sessionSets.length === 0) continue;
    const maxWeight = Math.max(...sessionSets.map((s) => s.weight));
    const topReps = Math.max(
      ...sessionSets.filter((s) => s.weight === maxWeight).map((s) => s.reps),
    );
    points.push({
      date: startedAt.toISOString().slice(0, 10),
      sessionStartedAt: startedAt,
      maxWeight,
      topSetReps: topReps,
      estimated1RM: +estimate1RM(maxWeight, topReps).toFixed(1),
      totalVolume: totalVolume(sessionSets),
    });
  }
  return points.sort((a, b) => a.sessionStartedAt.getTime() - b.sessionStartedAt.getTime());
}

export interface WeeklyVolumePoint {
  weekKey: string; // YYYY-Www
  weekStart: Date; // Monday 00:00 UTC
  // Volume per muscle group (kg). Absent groups count as 0.
  byMuscleGroup: Record<string, number>;
  total: number;
}

// Aggregates the weekly volume by muscle group.
// Input: non-warmup sets with their muscle group and the session date.
export function weeklyVolumeByMuscleGroup(
  sets: (Pick<Set, 'weight' | 'reps' | 'isWarmup'> & {
    muscleGroup: string;
    sessionStartedAt: Date;
  })[],
): WeeklyVolumePoint[] {
  const byWeek = new Map<string, WeeklyVolumePoint>();
  for (const s of sets) {
    if (s.isWarmup) continue;
    const key = isoWeekKey(s.sessionStartedAt);
    let entry = byWeek.get(key);
    if (!entry) {
      entry = {
        weekKey: key,
        weekStart: isoWeekStart(s.sessionStartedAt),
        byMuscleGroup: {},
        total: 0,
      };
      byWeek.set(key, entry);
    }
    const v = setVolume(s);
    entry.byMuscleGroup[s.muscleGroup] =
      (entry.byMuscleGroup[s.muscleGroup] ?? 0) + v;
    entry.total += v;
  }
  return [...byWeek.values()].sort(
    (a, b) => a.weekStart.getTime() - b.weekStart.getTime(),
  );
}
