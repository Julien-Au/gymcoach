'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// One downsampled sample of an imported activity (issue #254): t = seconds from
// the start, d = cumulative meters (optional), hr = bpm (optional).
interface TrackPoint {
  t: number;
  d?: number;
  hr?: number;
}

// Heart-rate-over-time chart for an imported cardio set that carries a track.
// Renders nothing unless there are at least two HR samples, so a track without
// heart rate (or a strength set) shows no empty chart.
export function ActivityTrackChart({ track }: { track: TrackPoint[] }) {
  const data = track
    .filter((p) => typeof p.hr === 'number')
    .map((p) => ({ min: Math.round((p.t / 60) * 10) / 10, hr: p.hr as number }));

  if (data.length < 2) return null;

  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground">Heart rate over time</p>
      <div className="h-40 w-full" data-testid="activity-track-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="min"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}'`}
              type="number"
              domain={['dataMin', 'dataMax']}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              width={34}
              allowDecimals={false}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip
              formatter={(value) => [`${value} bpm`, 'HR'] as [string, string]}
              labelFormatter={(label) => `${label} min`}
              contentStyle={{
                fontSize: 12,
                background: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
              }}
            />
            <Line
              type="monotone"
              dataKey="hr"
              stroke="hsl(var(--primary))"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
