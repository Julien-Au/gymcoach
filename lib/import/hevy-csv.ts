import { z } from 'zod';
import { MAX_DISTANCE_M, MAX_DURATION_SEC, MILES_TO_METERS } from '@/lib/cardio';
import { lbToKg, roundWeight } from '@/lib/units';
import {
  asNumber,
  headerKey,
  IMPORT_CSV_MAX_BYTES,
  IMPORT_CSV_MAX_ROWS,
  readCsvRecords,
  type CsvLineError,
} from '@/lib/import/csv';
import type { NormalizedImportRow } from '@/lib/import/strong-import';

// ============================================================
// Hevy app CSV export parser (issue #113) - pure, no DB
// ============================================================
// Mirrors lib/import/strong-csv.ts for Hevy's one-row-per-set export. The
// file content is UNTRUSTED user data: no eval, the same hard size and row
// caps, and every value Zod-validated before it leaves this module. Bad lines
// become per-line errors; only an unrecognized header or a blown cap is fatal.
//
// Hevy improvements over Strong's export that we honor:
// - start_time / end_time are real wall-clock times -> real session times
//   (Strong only gets the honest noon-UTC default).
// - set_type distinguishes warmup and dropset rows -> isWarmup / isDropSet.

export const HEVY_CSV_MAX_BYTES = IMPORT_CSV_MAX_BYTES;
export const HEVY_CSV_MAX_ROWS = IMPORT_CSV_MAX_ROWS;

// One normalized row: the shared NormalizedImportRow with the Hevy extras
// always present.
export interface HevyCsvRow extends NormalizedImportRow {
  isWarmup: boolean;
  isDropSet: boolean;
  startedAtIso: string | null;
  finishedAtIso: string | null;
}

export interface HevyCsvParseResult {
  // False when the file as a whole is unusable (bad header, cap exceeded).
  ok: boolean;
  fatalError: string | null;
  rows: HevyCsvRow[];
  errors: CsvLineError[];
  // Cardio rows that still cannot be represented (issue #134: zero/negative
  // or out-of-bounds duration), skipped with a counted notice. Representable
  // cardio rows are imported as duration/distance sets since #133.
  cardioSkipped: number;
}

// Bounds mirror lib/schemas/set.ts (and the Strong parser) so imported sets
// satisfy the same contract as manually logged ones.
const rowSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workoutName: z.string().trim().min(1).max(200),
  exerciseName: z.string().trim().min(1).max(120),
  setOrder: z.coerce.number().int().min(1).max(50),
  weightKg: z.coerce.number().min(0).max(500),
  reps: z.coerce.number().int().min(1).max(100),
});

// Cardio rows (issue #134): same identity fields, plus the #133 set bounds
// on duration/distance. weight/reps are forced to the cardio convention.
const cardioRowSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workoutName: z.string().trim().min(1).max(200),
  exerciseName: z.string().trim().min(1).max(120),
  setOrder: z.coerce.number().int().min(1).max(50),
  durationSec: z.number().int().min(1).max(MAX_DURATION_SEC),
  distanceM: z.number().min(0).max(MAX_DISTANCE_M).nullable(),
});

interface HeaderMap {
  title: number;
  startTime: number;
  endTime: number | null;
  exerciseTitle: number;
  setIndex: number;
  setType: number | null;
  weight: number;
  // True when the weight column is the lbs variant and must be converted.
  weightIsLbs: boolean;
  reps: number;
  distance: number | null;
  // True when the distance column is the miles variant (issue #134).
  distanceIsMiles: boolean;
  duration: number | null;
}

// Recognize Hevy's export header (snake_case columns; extra columns are fine,
// order does not matter; the documented lbs/miles variants are tolerated).
function mapHeader(cells: string[]): HeaderMap | null {
  const keys = cells.map(headerKey);
  const find = (...names: string[]) => {
    for (const name of names) {
      const idx = keys.indexOf(name);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const title = find('title');
  const startTime = find('start_time');
  const exerciseTitle = find('exercise_title');
  const setIndex = find('set_index');
  let weightIsLbs = false;
  let weight = find('weight_kg');
  if (weight === -1) {
    weight = find('weight_lbs', 'weight_lb');
    if (weight !== -1) weightIsLbs = true;
  }
  const reps = find('reps');

  if (
    title === -1 ||
    startTime === -1 ||
    exerciseTitle === -1 ||
    setIndex === -1 ||
    weight === -1 ||
    reps === -1
  ) {
    return null;
  }
  const endTime = find('end_time');
  const setType = find('set_type');
  let distanceIsMiles = false;
  let distance = find('distance_km');
  if (distance === -1) {
    distance = find('distance_miles');
    if (distance !== -1) distanceIsMiles = true;
  }
  const duration = find('duration_seconds');
  return {
    title,
    startTime,
    endTime: endTime === -1 ? null : endTime,
    exerciseTitle,
    setIndex,
    setType: setType === -1 ? null : setType,
    weight,
    weightIsLbs,
    reps,
    distance: distance === -1 ? null : distance,
    distanceIsMiles,
    duration: duration === -1 ? null : duration,
  };
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Parses Hevy's two documented timestamp formats into a UTC instant:
//   - '07 Jan 2024, 17:15'    (older exports)
//   - '2024-01-07 17:15:00'   (newer exports; seconds optional)
// Hevy exports local wall-clock times with no zone; we read them as UTC -
// the same honest convention as Strong's noon-UTC default, but with the real
// time of day preserved. Returns null when the cell is not a real date.
export function parseHevyTimestamp(
  cell: string,
): { dateKey: string; iso: string } | null {
  const trimmed = cell.trim();
  let y: number, mo: number, d: number, h: number, mi: number, s: number;

  let m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (m) {
    [y, mo, d, h, mi, s] = [
      Number(m[1]), Number(m[2]), Number(m[3]),
      Number(m[4]), Number(m[5]), Number(m[6] ?? 0),
    ];
  } else {
    m = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4}),? (\d{1,2}):(\d{2})$/.exec(trimmed);
    if (!m) return null;
    const month = MONTHS[m[2]!.toLowerCase()];
    if (!month) return null;
    [y, mo, d, h, mi, s] = [Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]), 0];
  }

  if (h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return { dateKey: date.toISOString().slice(0, 10), iso: date.toISOString() };
}

// Parse a Hevy CSV export. Hevy stores weight in kg (weight_kg); the lbs
// header variant is converted. There is no user-facing unit toggle.
export function parseHevyCsv(text: string): HevyCsvParseResult {
  const fail = (fatalError: string): HevyCsvParseResult => ({
    ok: false,
    fatalError,
    rows: [],
    errors: [],
    cardioSkipped: 0,
  });

  if (text.length > HEVY_CSV_MAX_BYTES) {
    return fail('File too large: the limit is 5 MB.');
  }

  const records = readCsvRecords(text);
  const header = records[0];
  if (!header) return fail('Empty file.');
  const map = mapHeader(header.fields);
  if (!map) {
    return fail(
      'Unrecognized format: expected a Hevy CSV export with the columns ' +
        'title, start_time, exercise_title, set_index, weight_kg, reps.',
    );
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length > HEVY_CSV_MAX_ROWS) {
    return fail(
      `Too many rows: ${dataRecords.length} (the limit is ${HEVY_CSV_MAX_ROWS}). Split the export and import in parts.`,
    );
  }

  const rows: HevyCsvRow[] = [];
  const errors: CsvLineError[] = [];
  let cardioSkipped = 0;

  for (const record of dataRecords) {
    const get = (idx: number | null) =>
      idx === null ? undefined : record.fields[idx];

    const start = parseHevyTimestamp(get(map.startTime) ?? '');
    if (!start) {
      errors.push({ line: record.line, reason: 'Invalid or missing start_time.' });
      continue;
    }
    // end_time is optional; a malformed one degrades to "no end time".
    const end = parseHevyTimestamp(get(map.endTime) ?? '');

    const reps = asNumber(get(map.reps));
    const weightRaw = asNumber(get(map.weight));
    const distance = asNumber(get(map.distance));
    const duration = asNumber(get(map.duration));

    // Cardio / duration-only rows (no reps, but distance or time) become
    // duration/distance sets (issue #134). The qualifying condition is
    // exactly the pre-#134 skip branch; only what happens to the row changed.
    if (!(reps >= 1) && (distance > 0 || duration > 0)) {
      // A representable cardio set needs a duration (the #133 model); a
      // distance-only or out-of-bounds row stays a counted skip notice.
      if (!(duration >= 1) || duration > MAX_DURATION_SEC) {
        cardioSkipped++;
        continue;
      }
      // distance_km in km, distance_miles in miles; stored in meters.
      const distanceM =
        distance > 0
          ? +(distance * (map.distanceIsMiles ? MILES_TO_METERS : 1000)).toFixed(2)
          : null;
      if (distanceM !== null && distanceM > MAX_DISTANCE_M) {
        cardioSkipped++;
        continue;
      }
      // Same set_index handling as strength rows: 0-based, a missing index
      // fails the row instead of colliding with real first sets.
      const cardioSetIndexCell = get(map.setIndex);
      const cardioSetIndex =
        cardioSetIndexCell === undefined || cardioSetIndexCell.trim() === ''
          ? NaN
          : asNumber(cardioSetIndexCell);
      const cardioParsed = cardioRowSchema.safeParse({
        dateKey: start.dateKey,
        workoutName: get(map.title) ?? '',
        exerciseName: get(map.exerciseTitle) ?? '',
        setOrder: cardioSetIndex + 1,
        durationSec: Math.round(duration),
        distanceM,
      });
      if (!cardioParsed.success) {
        const issue = cardioParsed.error.issues[0];
        errors.push({
          line: record.line,
          reason: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid row.',
        });
        continue;
      }
      const cardioSetType = headerKey(get(map.setType) ?? '');
      rows.push({
        ...cardioParsed.data,
        weightKg: 0,
        reps: 1,
        isWarmup: cardioSetType === 'warmup',
        isDropSet: cardioSetType === 'dropset',
        startedAtIso: start.iso,
        finishedAtIso: end?.iso ?? null,
      });
      continue;
    }

    const weightKg = map.weightIsLbs ? roundWeight(lbToKg(weightRaw), 2) : weightRaw;
    const setType = headerKey(get(map.setType) ?? '');

    // Hevy's set_index is 0-based; setNumber/setOrder are 1-based. A missing
    // index must NOT default to 0 (it would collide with real first sets and
    // be silently dropped as a duplicate), so it fails the row instead.
    const setIndexCell = get(map.setIndex);
    const setIndex =
      setIndexCell === undefined || setIndexCell.trim() === ''
        ? NaN
        : asNumber(setIndexCell);

    const parsed = rowSchema.safeParse({
      dateKey: start.dateKey,
      workoutName: get(map.title) ?? '',
      exerciseName: get(map.exerciseTitle) ?? '',
      setOrder: setIndex + 1,
      weightKg,
      reps,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push({
        line: record.line,
        reason: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid row.',
      });
      continue;
    }
    rows.push({
      ...parsed.data,
      isWarmup: setType === 'warmup',
      isDropSet: setType === 'dropset',
      startedAtIso: start.iso,
      finishedAtIso: end?.iso ?? null,
    });
  }

  return { ok: true, fatalError: null, rows, errors, cardioSkipped };
}
