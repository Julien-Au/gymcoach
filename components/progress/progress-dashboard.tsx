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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MUSCLE_GROUP_LABELS } from '@/lib/schemas/exercise';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MuscleGroup, WeightUnit } from '@prisma/client';
import {
  STALL_LOOKBACK_SESSIONS,
  type ExerciseChartPoint,
  type VolumeLandmarkZone,
} from '@/lib/stats';
import { roundWeight, toDisplayWeight, unitLabel } from '@/lib/units';
import { computeLoadingTable } from '@/lib/loading-table';
import { ExerciseGoalCard, type GoalView } from '@/components/progress/exercise-goal-card';
import { VolumeTargetEditor } from '@/components/progress/volume-target-editor';

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
  stalled: boolean;
}

interface SerializedWeeklyPoint {
  weekKey: string;
  weekStartIso: string;
  byMuscleGroup: Record<string, number>;
  total: number;
}

// Per-muscle-group classification of the latest completed week against the
// MEV/MRV band. Display-only; computed server-side in lib/stats.
interface VolumeLandmarks {
  weekKey: string;
  mev: number;
  mrv: number;
  byMuscleGroup: Record<
    string,
    {
      sets: number;
      // Issue #225: distinct training days for this muscle in the same week
      // (the weekly training frequency, shown as "Nx/week").
      frequency: number;
      zone: VolumeLandmarkZone;
      // Issue #211: the band actually applied to this group (the user's custom
      // target when set, else the defaults).
      mev: number;
      mrv: number;
      custom: boolean;
    }
  >;
}

interface Props {
  exercises: { id: string; name: string; muscleGroup: string }[];
  selectedExerciseId: string | undefined;
  exercisePoints: ExerciseChartPoint[];
  weeklyPoints: SerializedWeeklyPoint[];
  volumeLandmarks: VolumeLandmarks | null;
  // Issue #211: the user's saved per-muscle targets (muscleGroup -> band) and
  // the global defaults, for the inline editor.
  defaultBand: { mev: number; mrv: number };
  recap: RecapRow[];
  unit: WeightUnit;
  // Target goal for the selected exercise (issue #90), with the
  // bodyweight-adjusted best e1RM it is measured against.
  selectedGoal: GoalView | null;
  selectedBestE1RM: number;
  selectedUsesBodyweight: boolean;
}

// Badge variant + short label per zone. Below MEV and above MRV are both
// "off-target" (secondary/destructive); within the band reads as on-target.
const ZONE_META: Record<
  VolumeLandmarkZone,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  BELOW_MEV: { label: 'Below MEV', variant: 'secondary' },
  WITHIN: { label: 'In range', variant: 'default' },
  ABOVE_MRV: { label: 'Above MRV', variant: 'destructive' },
};

function muscleGroupLabel(group: string) {
  return MUSCLE_GROUP_LABELS[group as MuscleGroup] ?? group;
}

// Stable palette for muscle groups (distinct HSL, accessible LCH).
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
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

export function ProgressDashboard({
  exercises,
  selectedExerciseId,
  exercisePoints,
  weeklyPoints,
  volumeLandmarks,
  defaultBand,
  recap,
  unit,
  selectedGoal,
  selectedBestE1RM,
  selectedUsesBodyweight,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Convert a kg value to the display unit. KG returns the raw value unchanged
  // (so kg output stays byte-identical); LB rounds the conversion for clean
  // axes, tooltips, and table cells.
  const unitSuffix = unitLabel(unit);
  const toDisplay = (kg: number) =>
    unit === 'KG' ? kg : roundWeight(toDisplayWeight(kg, unit), 1);

  function selectExercise(id: string) {
    const params = new URLSearchParams(search.toString());
    params.set('exerciseId', id);
    startTransition(() => {
      router.push(`/progress?${params.toString()}`);
    });
  }

  const selectedExo = exercises.find((e) => e.id === selectedExerciseId);

  // Percentage-of-e1RM loading table (issue #226): rows of default percentages
  // of the selected exercise's best e1RM, rounded to a loadable increment in
  // the display unit. The best e1RM is stored in kg, so convert before deriving
  // so the rounding lands on plate jumps in the user's unit. Empty (table
  // hidden) when the exercise has no e1RM yet.
  const loadingRows = useMemo(
    () => computeLoadingTable(toDisplay(selectedBestE1RM), unit),
    // toDisplay is a pure function of `unit`; depend on its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedBestE1RM, unit],
  );

  // Read-only summary: exercises whose e1RM has plateaued recently.
  const stalledLifts = recap.filter((r) => r.stalled);

  // For the stacked bar chart: collect the groups present.
  const presentMuscleGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const p of weeklyPoints) {
      for (const k of Object.keys(p.byMuscleGroup)) groups.add(k);
    }
    return [...groups];
  }, [weeklyPoints]);

  // Flatten the weekly points for Recharts (key = weekKey, value per group),
  // converting each group volume to the display unit.
  const weeklyChartData = useMemo(() => {
    return weeklyPoints.map((p) => {
      const converted: Record<string, number> = {};
      for (const [group, value] of Object.entries(p.byMuscleGroup)) {
        converted[group] = toDisplay(value);
      }
      return {
        weekKey: p.weekKey,
        label: shortLabelFromWeekKey(p.weekKey),
        ...converted,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyPoints, unit]);

  // Sort the landmark rows by descending set count for a readable list.
  const landmarkRows = useMemo(() => {
    if (!volumeLandmarks) return [];
    return Object.entries(volumeLandmarks.byMuscleGroup)
      .map(([group, info]) => ({ group, ...info }))
      .sort((a, b) => b.sets - a.sets);
  }, [volumeLandmarks]);

  const exerciseChartData = exercisePoints.map((p) => ({
    ...p,
    label: shortDate(p.sessionStartedAt.toString()),
    maxWeight: toDisplay(p.maxWeight),
    estimated1RM: toDisplay(p.estimated1RM),
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Max load and 1RM per exercise */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Max load and estimated 1RM</h2>
            <Select
              value={selectedExerciseId ?? ''}
              onValueChange={selectExercise}
              disabled={isPending}
            >
              <SelectTrigger className="h-9 w-auto min-w-[12rem]">
                <SelectValue placeholder="Choose an exercise" />
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
              No data for this exercise.
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
                    name={`Max load (${unitSuffix})`}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="estimated1RM"
                    name={`Estimated 1RM (${unitSuffix})`}
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

      {/* Training loads table (issue #226): percentages of the selected
          exercise's best e1RM, rounded to a loadable increment in the display
          unit. Collapsible/secondary so it does not crowd the chart, and hidden
          entirely when the exercise has no e1RM yet. */}
      {selectedExerciseId && loadingRows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span className="text-base font-semibold">Training loads</span>
                <span className="text-xs text-muted-foreground group-open:hidden">
                  Show
                </span>
                <span className="hidden text-xs text-muted-foreground group-open:inline">
                  Hide
                </span>
              </summary>
              <p className="mt-1 text-xs text-muted-foreground">
                Percentages of your best estimated 1RM ({toDisplay(selectedBestE1RM)}{' '}
                {unitSuffix}), rounded to a loadable increment. Planning aid, not a
                prescription.
              </p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 font-medium">% of e1RM</th>
                    <th className="py-2 text-right font-medium">Load</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRows.map((row) => (
                    <tr key={row.percent} className="border-b last:border-0">
                      <td className="py-1.5">{row.percent}%</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {row.weight} {unitSuffix}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Target goal for the selected exercise */}
      {selectedExerciseId && selectedExo && (
        <ExerciseGoalCard
          exerciseId={selectedExerciseId}
          exerciseName={selectedExo.name}
          usesBodyweight={selectedUsesBodyweight}
          goal={selectedGoal}
          bestE1RM={selectedBestE1RM}
          unit={unit}
        />
      )}

      {/* Stacked weekly volume per muscle group */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Weekly volume per muscle group</h2>
          <p className="text-xs text-muted-foreground">
            Volume = sum of load × reps (working sets only).
          </p>
        </CardHeader>
        <CardContent>
          {weeklyChartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No weekly data.
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

      {/* Stalled lifts: e1RM flat over the recent sessions (read-only) */}
      {stalledLifts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold">Stalled lifts</h2>
            <p className="text-xs text-muted-foreground">
              No estimated 1RM progress over the last {STALL_LOOKBACK_SESSIONS}{' '}
              sessions. Consider a deload, a rep-range change, or swapping the
              exercise.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {stalledLifts.map((r) => (
                <li key={r.exerciseId}>
                  <Badge
                    variant="secondary"
                    className="text-amber-700 dark:text-amber-400"
                  >
                    {r.exerciseName}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Volume landmarks: latest week vs the MEV/MRV band */}
      {volumeLandmarks && landmarkRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold">Volume landmarks</h2>
            <p className="text-xs text-muted-foreground">
              Working sets in {shortLabelFromWeekKey(volumeLandmarks.weekKey)}{' '}
              vs your reference band (MEV-MRV) per muscle group. Defaults to{' '}
              {defaultBand.mev}-{defaultBand.mrv} sets/week; edit a group to set
              your own. General hypertrophy heuristic, not a prescription.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {landmarkRows.map((row) => {
                const meta = ZONE_META[row.zone];
                return (
                  <li
                    key={row.group}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium">
                        {muscleGroupLabel(row.group)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.mev}-{row.mrv}
                        {row.custom ? ' (custom)' : ' (default)'}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {row.sets} {row.sets === 1 ? 'set' : 'sets'}
                      </span>
                      {/* Weekly training frequency (issue #225): distinct
                          training days for this muscle in the same week. */}
                      <span className="text-xs text-muted-foreground">
                        {row.frequency}x/week
                      </span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <VolumeTargetEditor
                        muscleGroup={row.group}
                        label={muscleGroupLabel(row.group)}
                        mev={row.mev}
                        mrv={row.mrv}
                        custom={row.custom}
                        defaultMev={defaultBand.mev}
                        defaultMrv={defaultBand.mrv}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Progress recap table */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Last 12 weeks recap</h2>
        </CardHeader>
        <CardContent>
          {recap.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No exercise with enough data.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 font-medium">Exercise</th>
                    <th className="py-2 font-medium">Sessions</th>
                    <th className="py-2 font-medium">Load start → end</th>
                    <th className="py-2 font-medium">Δ load</th>
                    <th className="py-2 font-medium">Δ 1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.map((r) => (
                    <tr key={r.exerciseId} className="border-b border-border/40">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.exerciseName}</span>
                          {r.stalled && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400"
                              title={`No estimated 1RM progress over the last ${STALL_LOOKBACK_SESSIONS} sessions.`}
                            >
                              Stalled
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.muscleGroup}
                        </div>
                      </td>
                      <td className="py-2">{r.sessions}</td>
                      <td className="py-2">
                        {toDisplay(r.firstWeight)} → {toDisplay(r.lastWeight)} {unitSuffix}
                      </td>
                      <td className={`py-2 font-medium ${deltaClass(r.weightDelta)}`}>
                        {formatDelta(toDisplay(r.weightDelta))} {unitSuffix}
                      </td>
                      <td className={`py-2 ${deltaClass(r.e1rmDelta)}`}>
                        {formatDelta(toDisplay(r.e1rmDelta))} {unitSuffix}
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
  // "2026-W18" -> "W18"
  const parts = weekKey.split('-W');
  return parts[1] ? `W${parts[1]}` : weekKey;
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
