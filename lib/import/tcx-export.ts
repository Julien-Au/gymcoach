import type { TcxSport } from '@/lib/import/tcx';

// ============================================================
// TCX activity file serializer (issue #175) - pure, no DB
// ============================================================
// The outbound half of data ownership: a finished cardio session out as a
// minimal, valid TCX 1.0/2.0 Activity that Strava and analysis tools accept.
// One <Lap> per cardio set (TotalTimeSeconds / DistanceMeters /
// AverageHeartRateBpm), no GPS Trackpoints - totals alone are enough.
//
// SECURITY: we only ever emit a FIXED minimal structure - no DTD, no DOCTYPE,
// no external entities, no processing instructions beyond the XML declaration.
// Every text value we interpolate (even though TCX here carries only numbers
// and ISO timestamps) is passed through xmlEscape so a hostile note/name or a
// future free-text field can never break out of its element or inject markup.

// One cardio set's totals. distanceM/avgHr are omitted when absent (a
// duration-only erg set has no distance; a watch may not record heart rate).
export interface TcxExportLap {
  durationSec: number;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
}

export interface TcxExportActivity {
  // Activity start (the <Id> and first lap StartTime). Serialized as ISO 8601.
  startedAt: Date;
  sport: TcxSport;
  laps: TcxExportLap[];
}

// Neutralizes the five XML metacharacters so no emitted text can break the
// document. '&' must be replaced first so the entities we introduce are not
// themselves re-escaped.
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Maps our stored exercise name to the TCX Sport attribute. This is the
// inverse of tcxExerciseName (the import's sport -> name mapping): 'Running'
// -> Running, 'Cycling' -> Biking, everything else -> Other. Case-insensitive
// on the known names so a manually renamed exercise still maps sensibly.
export function sportForExerciseName(name: string): TcxSport {
  const normalized = name.trim().toLowerCase();
  if (normalized === 'running') return 'Running';
  if (normalized === 'cycling') return 'Biking';
  return 'Other';
}

function lapXml(lap: TcxExportLap, startTime: string): string {
  // TotalTimeSeconds is required; DistanceMeters and the HR block are emitted
  // only when present. Intensity=Active and a Manual trigger keep the lap
  // valid for strict consumers without inventing data.
  const lines: string[] = [];
  lines.push(`      <Lap StartTime="${xmlEscape(startTime)}">`);
  // Defensive: only finite numbers reach the document, so a NaN/Infinity that
  // ever slipped past the upstream write schema can never emit invalid TCX
  // (the schemas already bound these; this keeps the serializer correct on
  // its own).
  const duration = Number.isFinite(lap.durationSec) ? lap.durationSec : 0;
  lines.push(`        <TotalTimeSeconds>${duration}</TotalTimeSeconds>`);
  if (lap.distanceM != null && Number.isFinite(lap.distanceM) && lap.distanceM > 0) {
    lines.push(`        <DistanceMeters>${lap.distanceM}</DistanceMeters>`);
  }
  // A HeartRateBpm Value of 0 is invalid TCX; emit the block only for a real
  // positive reading (symmetric with the distance gate above).
  if (lap.avgHr != null && Number.isFinite(lap.avgHr) && lap.avgHr > 0) {
    lines.push('        <AverageHeartRateBpm>');
    lines.push(`          <Value>${lap.avgHr}</Value>`);
    lines.push('        </AverageHeartRateBpm>');
  }
  // Max HR (issue #203): same positive-finite gate as the average so a 0 or a
  // NaN never emits an invalid HeartRateBpm block. The parser reads it back as
  // MaximumHeartRateBpm, so a round-trip preserves the value.
  if (lap.maxHr != null && Number.isFinite(lap.maxHr) && lap.maxHr > 0) {
    lines.push('        <MaximumHeartRateBpm>');
    lines.push(`          <Value>${lap.maxHr}</Value>`);
    lines.push('        </MaximumHeartRateBpm>');
  }
  lines.push('        <Intensity>Active</Intensity>');
  lines.push('        <TriggerMethod>Manual</TriggerMethod>');
  lines.push('      </Lap>');
  return lines.join('\n');
}

// Serializes one cardio session to a TCX document string. The structure is
// fixed; only numeric totals and the ISO start timestamp vary. Every laps'
// StartTime reuses the activity start (we do not store per-lap clock times),
// which is valid and round-trips through the parser to the same totals.
export function serializeTcx(activity: TcxExportActivity): string {
  const startIso = xmlEscape(activity.startedAt.toISOString());
  const sport = xmlEscape(activity.sport);
  const laps = activity.laps.map((lap) => lapXml(lap, activity.startedAt.toISOString())).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="${sport}">
      <Id>${startIso}</Id>
${laps}
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}
