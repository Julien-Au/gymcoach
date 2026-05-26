import type { Set } from '@prisma/client';

// ============================================================
// Stats d'entraînement - volume, 1RM estimé, agrégation hebdo
// ============================================================

// ============================================================
// Bodyweight : tonnage effectif sur les exos au poids du corps
// ============================================================

// Charge effective d'une série : pour les exos `usesBodyweight`, on ajoute le
// poids du corps de l'utilisateur. `setWeight` reste la valeur saisie (lest
// ajouté ou négatif pour l'assistance). Si le user n'a pas renseigné son
// bodyweight, on retourne setWeight tel quel (rétrograde-safe).
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

// Enrichit une liste de sets avec leur charge effective. Les sets doivent être
// décorés au préalable avec `usesBodyweight` (typiquement copié depuis
// `set.exercise.usesBodyweight` côté Server Component). On évite de mutter,
// on retourne une nouvelle liste.
export function applyBodyweight<
  T extends { weight: number; usesBodyweight?: boolean | null },
>(sets: T[], bodyweight: number | null | undefined): T[] {
  if (!bodyweight || bodyweight <= 0) return sets;
  return sets.map((s) =>
    s.usesBodyweight ? { ...s, weight: +(bodyweight + s.weight).toFixed(2) } : s,
  );
}

// Volume d'une série = charge × reps. Pour le poids du corps (weight = 0),
// on retourne 0 par convention (impossible à comparer avec une charge).
export function setVolume(set: Pick<Set, 'weight' | 'reps' | 'isWarmup'>): number {
  if (set.isWarmup) return 0;
  return set.weight * set.reps;
}

// Volume total d'une liste de séries (somme, hors warmup).
export function totalVolume(sets: Pick<Set, 'weight' | 'reps' | 'isWarmup'>[]): number {
  return sets.reduce((acc, s) => acc + setVolume(s), 0);
}

// 1RM estimé via la formule d'Epley : weight × (1 + reps / 30).
// Retourne 0 pour les séries à 0 kg (poids du corps non comparable).
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

// Meilleur 1RM estimé sur une liste de séries (warmup et drop sets inclus
// car techniquement valides pour estimer la force).
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
// Semaine ISO (lundi-dimanche) - clé YYYY-Www, label "S{w} YYYY"
// ============================================================

// Retourne la clé ISO d'une date au format "YYYY-Www" (semaine commençant lundi).
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Jeudi de la semaine courante (ISO : la semaine appartient à l'année où tombe son jeudi).
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Date du lundi (00:00 UTC) de la semaine ISO contenant la date donnée.
export function isoWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dayNum - 1));
  return d;
}

// ============================================================
// Agrégations
// ============================================================

export interface ExerciseChartPoint {
  date: string; // ISO date (YYYY-MM-DD) de la séance
  sessionStartedAt: Date;
  maxWeight: number;
  topSetReps: number; // reps de la meilleure série (max weight)
  estimated1RM: number;
  totalVolume: number;
}

// Pour un exercice, agrège chaque séance en un point de progression.
// Entrée : sets ordonnés par session, avec sessionStartedAt joint.
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
  weekStart: Date; // monday 00:00 UTC
  // Volume par groupe musculaire (kg). Les groupes absents valent 0.
  byMuscleGroup: Record<string, number>;
  total: number;
}

// Agrège le volume hebdomadaire par groupe musculaire.
// Entrée : sets non-warmup avec leur muscle group et la date de session.
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
