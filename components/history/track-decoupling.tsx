import { trackDecoupling } from '@/lib/cardio';
import type { TrackPoint } from '@/lib/import/track';

// Threshold (in percent) under which the pace-per-heartbeat efficiency is
// considered to have held steady. ~5% is the commonly used cutoff for a
// well-paced aerobic effort.
const STEADY_THRESHOLD_PCT = 5;

// Aerobic decoupling readout for an imported cardio set (issue #268): one
// percentage plus a plain-language explainer, shown only when the stored
// track carries both cumulative distance and heart rate (trackDecoupling
// returns null otherwise, and this renders nothing).
export function TrackDecoupling({ track }: { track: TrackPoint[] }) {
  const decoupling = trackDecoupling(track);
  if (decoupling == null) return null;

  const held = decoupling <= STEADY_THRESHOLD_PCT;
  return (
    <div className="mt-3 text-xs" data-testid="track-decoupling">
      <p className="font-medium text-muted-foreground">Aerobic decoupling</p>
      <p className="mt-0.5">
        <span className="text-sm font-semibold">{decoupling.toFixed(1)}%</span>
        <span className="ml-2 text-muted-foreground">
          Lower is better - your pace per heartbeat{' '}
          {held ? 'held steady' : 'faded'} over the second half of this
          activity.
        </span>
      </p>
    </div>
  );
}
