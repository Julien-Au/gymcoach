'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExerciseChartPoint } from '@/lib/stats';

interface RecapRow {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sessions: number;
  firstWeight: number;
  firstDate: string;
  lastWeight: number;
  lastDate: string;
  weightDelta: number;
  firstE1RM: number;
  lastE1RM: number;
  e1rmDelta: number;
}

interface SerializedWeeklyPoint {
  weekKey: string;
  weekStartIso: string;
  byMuscleGroup: Record<string, number>;
  total: number;
}

interface Props {
  exercises: { id: string; name: string; muscleGroup: string }[];
  selectedExerciseId: string | undefined;
  exercisePoints: ExerciseChartPoint[];
  weeklyPoints: SerializedWeeklyPoint[];
  recap: RecapRow[];
}

// Palette stable pour les groupes musculaires (HSL distincts, accessible LCH).
const MUSCLE_COLORS: Record<string, string> = {
  CHEST: '#ef4444',
  BACK_WIDTH: '#3b82f6',
  BACK_THICKNESS: '#1d4ed8',
  SHOULDERS_FRONT: '#f59e0b',
  SHOULDERS_LATERAL: '#fbbf24',
  SHOULDERS_REAR: '#d97706',
  BICEPS: '#a855f7',
  TRICEPS: '#9333ea',
  FOREARMS: '#7c3aed',
  QUADS: '#10b981',
  HAMSTRINGS: '#059669',
  GLUTES: '#34d399',
  CALVES: '#14b8a6',
  ABS: '#64748b',
  LOWER_BACK: '#475569',
};

function shortDate(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

export function ProgressDashboard({
  exercises,
  selectedExerciseId,
  exercisePoints,
  weeklyPoints,
  recap,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function selectExercise(id: string) {
    const params = new URLSearchParams(search.toString());
    params.set('exerciseId', id);
    startTransition(() => {
      router.push(`/progress?${params.toString()}`);
    });
  }

  const selectedExo = exercises.find((e) => e.id === selectedExerciseId);

  // Pour le bar chart empilé : on collecte les groupes présents.
  const presentMuscleGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const p of weeklyPoints) {
      for (const k of Object.keys(p.byMuscleGroup)) groups.add(k);
    }
    return [...groups];
  }, [weeklyPoints]);

  // Aplatit les points hebdo pour Recharts (clé = weekKey, value par groupe).
  const weeklyChartData = useMemo(() => {
    return weeklyPoints.map((p) => ({
      weekKey: p.weekKey,
      label: shortLabelFromWeekKey(p.weekKey),
      ...p.byMuscleGroup,
    }));
  }, [weeklyPoints]);

  const exerciseChartData = exercisePoints.map((p) => ({
    label: shortDate(p.sessionStartedAt.toString()),
    ...p,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Charge max et 1RM par exercice */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Charge max et 1RM estimé</h2>
            <Select
              value={selectedExerciseId ?? ''}
              onValueChange={selectExercise}
              disabled={isPending}
            >
              <SelectTrigger className="h-9 w-auto min-w-[12rem]">
                <SelectValue placeholder="Choisir un exercice" />
              </SelectTrigger>
              <SelectContent>
                {exercises.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedExo && (
            <p className="text-xs text-muted-foreground">
              {selectedExo.muscleGroup}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {exerciseChartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pas de données pour cet exercice.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={exerciseChartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="maxWeight"
                    name="Charge max (kg)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="estimated1RM"
                    name="1RM estimé (kg)"
                    stroke="#a855f7"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Volume hebdomadaire empilé par groupe musculaire */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Volume hebdo par groupe musculaire</h2>
          <p className="text-xs text-muted-foreground">
            Volume = somme charge × reps (séries de travail uniquement).
          </p>
        </CardHeader>
        <CardContent>
          {weeklyChartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune donnée hebdomadaire.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {presentMuscleGroups.map((group) => (
                    <Bar
                      key={group}
                      dataKey={group}
                      stackId="vol"
                      fill={MUSCLE_COLORS[group] ?? '#94a3b8'}
                      name={group}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tableau récap progression */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Récap des 12 dernières semaines</h2>
        </CardHeader>
        <CardContent>
          {recap.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun exercice avec assez de données.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 font-medium">Exercice</th>
                    <th className="py-2 font-medium">Séances</th>
                    <th className="py-2 font-medium">Charge début → fin</th>
                    <th className="py-2 font-medium">Δ charge</th>
                    <th className="py-2 font-medium">Δ 1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.map((r) => (
                    <tr key={r.exerciseId} className="border-b border-border/40">
                      <td className="py-2">
                        <div className="font-medium">{r.exerciseName}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.muscleGroup}
                        </div>
                      </td>
                      <td className="py-2">{r.sessions}</td>
                      <td className="py-2">
                        {r.firstWeight} → {r.lastWeight} kg
                      </td>
                      <td className={`py-2 font-medium ${deltaClass(r.weightDelta)}`}>
                        {formatDelta(r.weightDelta)} kg
                      </td>
                      <td className={`py-2 ${deltaClass(r.e1rmDelta)}`}>
                        {formatDelta(r.e1rmDelta)} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function shortLabelFromWeekKey(weekKey: string) {
  // "2026-W18" -> "S18"
  const parts = weekKey.split('-W');
  return parts[1] ? `S${parts[1]}` : weekKey;
}

function formatDelta(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function deltaClass(n: number) {
  if (n > 0) return 'text-emerald-600';
  if (n < 0) return 'text-rose-600';
  return 'text-muted-foreground';
}
