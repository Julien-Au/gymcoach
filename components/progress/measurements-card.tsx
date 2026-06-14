'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ruler, Trash2 } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BodyMeasurementSite, WeightUnit } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatLength,
  fromDisplayLength,
  MEASUREMENT_SITES,
  measurementSiteLabel,
  roundLength,
  toDisplayLength,
} from '@/lib/measurement';

// One body measurement, as serialized at the Server Component boundary.
export interface BodyMeasurementView {
  id: string;
  site: BodyMeasurementSite;
  valueCm: number;
  measuredAt: string; // ISO
}

interface Props {
  // All measurements of the trend window, newest first, across every site.
  entries: BodyMeasurementView[];
  unit: WeightUnit;
  // How many recent entries (for the selected site) get a list row.
  listLimit?: number;
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));
}

// Body-measurement card (issue #202), mirroring the bodyweight card (#99):
// pick a site, quick-add a value in the display unit (cm in metric, inches in
// imperial), see the latest value per site and a trend for the selected site,
// delete bad entries. Storage is always cm; the unit only affects display.
export function MeasurementsCard({ entries, unit, listLimit = 5 }: Props) {
  const router = useRouter();
  const metric = unit !== 'LB';
  const unitSuffix = metric ? 'cm' : 'in';

  const [site, setSite] = useState<BodyMeasurementSite>('WAIST');
  const [valueField, setValueField] = useState('');
  const [busy, setBusy] = useState(false);

  // Newest entry per site, for the "latest per site" summary grid.
  const latestPerSite = useMemo(() => {
    const map = new Map<BodyMeasurementSite, BodyMeasurementView>();
    // entries are newest-first, so the first one seen per site is the latest.
    for (const e of entries) {
      if (!map.has(e.site)) map.set(e.site, e);
    }
    return map;
  }, [entries]);

  // Entries for the selected site, newest first.
  const siteEntries = useMemo(
    () => entries.filter((e) => e.site === site),
    [entries, site],
  );

  // Chart data for the selected site, oldest to newest, in the display unit.
  const chartData = useMemo(
    () =>
      [...siteEntries]
        .reverse()
        .map((e) => ({
          label: shortDate(e.measuredAt),
          value: roundLength(toDisplayLength(e.valueCm, metric)),
        })),
    [siteEntries, metric],
  );

  async function addEntry() {
    const value = parseFloat(valueField);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a positive measurement.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, valueCm: fromDisplayLength(value, metric) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not log the measurement.');
        return;
      }
      toast.success('Measurement logged.');
      setValueField('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/measurements/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not delete the measurement.');
        return;
      }
      toast.success('Measurement deleted.');
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
            <Ruler className="size-4" />
            Measurements
          </h2>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Site selector + quick add, in the display unit */}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addEntry();
          }}
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="measurement-site">Site</Label>
            <select
              id="measurement-site"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={site}
              onChange={(e) => setSite(e.target.value as BodyMeasurementSite)}
            >
              {MEASUREMENT_SITES.map((s) => (
                <option key={s} value={s}>
                  {measurementSiteLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="measurement-value">Value ({unitSuffix})</Label>
            <Input
              id="measurement-value"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={valueField}
              onChange={(e) => setValueField(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Log'}
          </Button>
        </form>

        {/* Latest value per site */}
        {latestPerSite.size > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {MEASUREMENT_SITES.filter((s) => latestPerSite.has(s)).map((s) => (
              <div key={s} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{measurementSiteLabel(s)}</span>
                <span className="font-medium">
                  {formatLength(latestPerSite.get(s)!.valueCm, metric)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Trend for the selected site */}
        {chartData.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            {chartData.length === 0
              ? `No ${measurementSiteLabel(site).toLowerCase()} measurement yet. Log one to start the trend.`
              : `Log a second ${measurementSiteLabel(site).toLowerCase()} measurement to see the trend.`}
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
                  dataKey="value"
                  name={`${measurementSiteLabel(site)} (${unitSuffix})`}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent entries for the selected site, deletable */}
        {siteEntries.length > 0 && (
          <ul className="flex flex-col gap-1">
            {siteEntries.slice(0, listLimit).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  <span className="font-medium">{formatLength(e.valueCm, metric)}</span>{' '}
                  <span className="text-muted-foreground">on {shortDate(e.measuredAt)}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${measurementSiteLabel(e.site)} measurement of ${shortDate(e.measuredAt)}`}
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
