import { AVG_HR_MAX, AVG_HR_MIN, MAX_DISTANCE_M, MAX_DURATION_SEC } from '@/lib/cardio';

// A downsampled sample of an imported cardio activity (issues #254, #259): t =
// seconds from the activity start, d = cumulative meters (optional), hr = bpm
// (optional). Shared by the FIT, GPX (and later TCX) importers and rendered by
// components/history/activity-track-chart.tsx.
export interface TrackPoint {
  t: number;
  d?: number;
  hr?: number;
}

// At most this many points are stored/charted per activity, so a long, dense
// recording cannot bloat the row or the chart. The importers separately cap the
// number of RAW samples they collect, so memory is bounded before this runs.
export const MAX_TRACK_POINTS = 500;

// Build one sanitized point or null: drops a non-finite or out-of-window time,
// and keeps distance/HR only when in the same range the cardio set enforces
// (so a sensor glitch degrades to "absent", never a bad stored value).
export function cleanTrackPoint(
  t: number,
  dMeters: number | null | undefined,
  hr: number | null | undefined,
): TrackPoint | null {
  if (!Number.isFinite(t) || t < 0 || t > MAX_DURATION_SEC) return null;
  const point: TrackPoint = { t: Math.round(t) };
  if (dMeters != null && Number.isFinite(dMeters) && dMeters >= 0 && dMeters <= MAX_DISTANCE_M) {
    point.d = Math.round(dMeters * 100) / 100;
  }
  if (hr != null && Number.isFinite(hr) && hr >= AVG_HR_MIN && hr <= AVG_HR_MAX) {
    point.hr = Math.round(hr);
  }
  return point;
}

// Evenly stride a list of already-sanitized points down to MAX_TRACK_POINTS,
// or null when there is nothing to store.
export function downsampleTrack(points: TrackPoint[]): TrackPoint[] | null {
  if (points.length === 0) return null;
  const stride = Math.max(1, Math.ceil(points.length / MAX_TRACK_POINTS));
  const out: TrackPoint[] = [];
  for (let i = 0; i < points.length; i += stride) out.push(points[i]!);
  return out.length > 0 ? out : null;
}
