'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Scale, Trash2 } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeightUnit } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  // How many recent entries get a row in the list below the chart.
  listLimit?: number;
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));
}

// Bodyweight trend card (issue #99): quick-add a measurement in the display
// unit, see the trend over the window, delete bad entries. The profile field
// in settings keeps working separately (corrections, not measurements).
export function BodyweightCard({ entries, unit, listLimit = 5 }: Props) {
  const router = useRouter();
  const [weightField, setWeightField] = useState('');
  const [busy, setBusy] = useState(false);

  const unitSuffix = unitLabel(unit);

  // Chart data, oldest to newest, in the display unit.
  const chartData = useMemo(
    () =>
      [...entries]
        .reverse()
        .map((e) => ({
          label: shortDate(e.measuredAt),
          weight: roundWeight(toDisplayWeight(e.weightKg, unit), 1),
        })),
    [entries, unit],
  );

  const latest = entries[0];

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
            Bodyweight
          </h2>
          {latest && (
            <span className="text-sm text-muted-foreground">
              Current: {formatWeight(latest.weightKg, unit)}
            </span>
          )}
        </div>
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
            <Label htmlFor="bodyweight-input">Bodyweight ({unitSuffix})</Label>
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
            {busy ? 'Saving...' : 'Log'}
          </Button>
        </form>

        {/* Trend over the window */}
        {chartData.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            {chartData.length === 0
              ? 'No bodyweight logged yet. Log a first measurement to start the trend.'
              : 'Log a second measurement to see the trend.'}
          </p>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  domain={['auto', 'auto']}
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

        {/* Recent entries, deletable */}
        {entries.length > 0 && (
          <ul className="flex flex-col gap-1">
            {entries.slice(0, listLimit).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  <span className="font-medium">{formatWeight(e.weightKg, unit)}</span>{' '}
                  <span className="text-muted-foreground">on {shortDate(e.measuredAt)}</span>
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
