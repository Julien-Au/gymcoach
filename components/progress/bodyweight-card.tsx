'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Scale, Trash2 } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeightUnit } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bodyweightGoalStatus, chartDomainWithGoal } from '@/lib/bodyweight-goal';
import { cn } from '@/lib/utils';
import {
  formatWeight,
  fromDisplayWeight,
  roundWeight,
  toDisplayWeight,
  unitLabel,
} from '@/lib/units';

// One bodyweight measurement, as serialized by the Server Component boundary.
export interface BodyweightEntryView {
  id: string;
  weightKg: number;
  measuredAt: string; // ISO
}

interface Props {
  // Entries of the trend window, newest first.
  entries: BodyweightEntryView[];
  unit: WeightUnit;
  // Target bodyweight in kg (issue #398), null when no goal is set.
  goalKg?: number | null;
  // How many recent entries get a row in the list below the chart.
  listLimit?: number;
}

// Bodyweight trend card (issue #99): quick-add a measurement in the display
// unit, see the trend over the window, delete bad entries. The profile field
// in settings keeps working separately (corrections, not measurements).
// Same bounds as the profile schema's bodyweightGoalKg, in kg.
const GOAL_MIN_KG = 20;
const GOAL_MAX_KG = 300;

const TONE_CLASS = {
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-muted-foreground',
} as const;

export function BodyweightCard({ entries, unit, goalKg = null, listLimit = 5 }: Props) {
  const t = useTranslations('progress.bodyweight');
  const common = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const [weightField, setWeightField] = useState('');
  const [goalField, setGoalField] = useState('');
  const [busy, setBusy] = useState(false);

  const unitSuffix = unitLabel(unit);
  const shortDate = useCallback(
    (iso: string) =>
      format.dateTime(new Date(iso), { day: '2-digit', month: '2-digit' }),
    [format],
  );

  // Chart data, oldest to newest, in the display unit.
  const chartData = useMemo(
    () =>
      [...entries]
        .reverse()
        .map((e) => ({
          label: shortDate(e.measuredAt),
          weight: roundWeight(toDisplayWeight(e.weightKg, unit), 1),
        })),
    [entries, unit, shortDate],
  );

  const latest = entries[0];
  const oldest = entries[entries.length - 1];
  const goalDisplay = goalKg != null ? roundWeight(toDisplayWeight(goalKg, unit), 1) : null;
  const yDomain = chartDomainWithGoal(
    chartData.map((point) => point.weight),
    goalDisplay,
  );
  const goalStatus =
    goalKg != null && latest && oldest
      ? bodyweightGoalStatus(oldest.weightKg, latest.weightKg, goalKg)
      : null;

  async function saveGoal(nextGoalKg: number | null) {
    setBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyweightGoalKg: nextGoalKg }),
      });
      if (!res.ok) {
        toast.error(t('goalError'));
        return;
      }
      toast.success(nextGoalKg == null ? t('goalRemoved') : t('goalSaved'));
      setGoalField('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function submitGoal() {
    const value = parseFloat(goalField);
    const kg = Number.isFinite(value) ? fromDisplayWeight(value, unit) : NaN;
    if (!Number.isFinite(kg) || kg < GOAL_MIN_KG || kg > GOAL_MAX_KG) {
      toast.error(
        t('goalInvalid', {
          min: Math.ceil(toDisplayWeight(GOAL_MIN_KG, unit)),
          max: Math.floor(toDisplayWeight(GOAL_MAX_KG, unit)),
          unit: unitSuffix,
        }),
      );
      return;
    }
    void saveGoal(kg);
  }

  async function addEntry() {
    const weight = parseFloat(weightField);
    if (!Number.isFinite(weight) || weight <= 0) {
      toast.error('Enter a positive bodyweight.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/bodyweight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weightKg: fromDisplayWeight(weight, unit) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not log the bodyweight.');
        return;
      }
      toast.success('Bodyweight logged.');
      setWeightField('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/bodyweight/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not delete the entry.');
        return;
      }
      toast.success('Entry deleted.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Scale className="size-4" />
            {t('title')}
          </h2>
          {latest && (
            <span className="text-sm text-muted-foreground">
              {t('current', { weight: formatWeight(latest.weightKg, unit, { locale }) })}
            </span>
          )}
        </div>
        {goalKg != null && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="text-muted-foreground">
              {t('goal', { weight: formatWeight(goalKg, unit, { locale }) })}
            </span>
            {goalStatus && (
              <span
                data-testid="bodyweight-goal-delta"
                data-tone={goalStatus.tone}
                className={cn('font-medium', TONE_CLASS[goalStatus.tone])}
              >
                {goalStatus.reached
                  ? t('goalReached')
                  : t('goalToGo', {
                      weight: formatWeight(goalStatus.remainingKg, unit, { locale }),
                    })}
              </span>
            )}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Quick add, in the display unit */}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addEntry();
          }}
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="bodyweight-input">{t('label', { unit: unitSuffix })}</Label>
            <Input
              id="bodyweight-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder={
                latest
                  ? String(roundWeight(toDisplayWeight(latest.weightKg, unit), 1))
                  : undefined
              }
              value={weightField}
              onChange={(e) => setWeightField(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? common('actions.saving') : t('log')}
          </Button>
        </form>

        {/* Trend over the window */}
        {chartData.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            {chartData.length === 0
              ? t('empty')
              : t('second')}
          </p>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  domain={yDomain ?? ['auto', 'auto']}
                  tickFormatter={(v: number) => String(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                {goalDisplay != null && (
                  <ReferenceLine
                    y={goalDisplay}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="6 4"
                    label={{
                      value: t('goalLine'),
                      position: 'insideTopRight',
                      fontSize: 11,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="weight"
                  name={`Bodyweight (${unitSuffix})`}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Goal (issue #398), in the display unit */}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitGoal();
          }}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="bodyweight-goal-input">{t('goalLabel', { unit: unitSuffix })}</Label>
            <Input
              id="bodyweight-goal-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder={goalDisplay != null ? String(goalDisplay) : undefined}
              value={goalField}
              onChange={(e) => setGoalField(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy}>
            {t('goalSet')}
          </Button>
          {goalKg != null && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void saveGoal(null)}
            >
              {t('goalRemove')}
            </Button>
          )}
        </form>

        {/* Recent entries, deletable */}
        {entries.length > 0 && (
          <ul className="flex flex-col gap-1">
            {entries.slice(0, listLimit).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {formatWeight(e.weightKg, unit, { locale })}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    {t('onDate', { date: shortDate(e.measuredAt) })}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete entry of ${shortDate(e.measuredAt)}`}
                  onClick={() => void deleteEntry(e.id)}
                  disabled={busy}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
