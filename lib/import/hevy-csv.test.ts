import { describe, it, expect } from 'vitest';
import {
  HEVY_CSV_MAX_BYTES,
  HEVY_CSV_MAX_ROWS,
  parseHevyCsv,
  parseHevyTimestamp,
} from './hevy-csv';

const HEADER =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';

function csv(...lines: string[]) {
  return [HEADER, ...lines].join('\n');
}

// One data line with sensible defaults, field-overridable.
function line(over: Partial<Record<string, string>> = {}) {
  const f = {
    title: 'Push Day',
    start_time: '2026-05-02 09:13:00',
    end_time: '2026-05-02 10:05:00',
    description: '',
    exercise_title: 'Bench Press (Barbell)',
    superset_id: '',
    exercise_notes: '',
    set_index: '0',
    set_type: 'normal',
    weight_kg: '80',
    reps: '8',
    distance_km: '',
    duration_seconds: '',
    rpe: '',
    ...over,
  };
  return [
    f.title, f.start_time, f.end_time, f.description, f.exercise_title,
    f.superset_id, f.exercise_notes, f.set_index, f.set_type, f.weight_kg,
    f.reps, f.distance_km, f.duration_seconds, f.rpe,
  ].join(',');
}

describe('parseHevyTimestamp', () => {
  it('parses the newer ISO-like format with and without seconds', () => {
    expect(parseHevyTimestamp('2026-05-02 09:13:00')).toEqual({
      dateKey: '2026-05-02',
      iso: '2026-05-02T09:13:00.000Z',
    });
    expect(parseHevyTimestamp('2026-05-02 09:13')?.iso).toBe('2026-05-02T09:13:00.000Z');
  });

  it('parses the older "07 Jan 2024, 17:15" format', () => {
    expect(parseHevyTimestamp('07 Jan 2024, 17:15')).toEqual({
      dateKey: '2024-01-07',
      iso: '2024-01-07T17:15:00.000Z',
    });
  });

  it('rejects garbage and impossible dates/times', () => {
    expect(parseHevyTimestamp('not-a-date')).toBeNull();
    expect(parseHevyTimestamp('2026-13-40 09:00:00')).toBeNull();
    expect(parseHevyTimestamp('2026-05-02 25:00:00')).toBeNull();
    expect(parseHevyTimestamp('07 Foo 2024, 17:15')).toBeNull();
    expect(parseHevyTimestamp('')).toBeNull();
  });
});

describe('parseHevyCsv happy path', () => {
  it('parses working sets into normalized rows with real times', () => {
    const res = parseHevyCsv(csv(line({ set_index: '0' }), line({ set_index: '1', reps: '7' })));
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.rows).toEqual([
      {
        dateKey: '2026-05-02',
        workoutName: 'Push Day',
        exerciseName: 'Bench Press (Barbell)',
        setOrder: 1,
        weightKg: 80,
        reps: 8,
        isWarmup: false,
        isDropSet: false,
        startedAtIso: '2026-05-02T09:13:00.000Z',
        finishedAtIso: '2026-05-02T10:05:00.000Z',
      },
      {
        dateKey: '2026-05-02',
        workoutName: 'Push Day',
        exerciseName: 'Bench Press (Barbell)',
        setOrder: 2,
        weightKg: 80,
        reps: 7,
        isWarmup: false,
        isDropSet: false,
        startedAtIso: '2026-05-02T09:13:00.000Z',
        finishedAtIso: '2026-05-02T10:05:00.000Z',
      },
    ]);
  });

  it('maps set_type warmup and dropset onto the set flags', () => {
    const res = parseHevyCsv(
      csv(
        line({ set_type: 'warmup', weight_kg: '40' }),
        line({ set_index: '1', set_type: 'dropset', weight_kg: '60' }),
        line({ set_index: '2', set_type: 'failure' }),
      ),
    );
    expect(res.rows.map((r) => [r.isWarmup, r.isDropSet])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const res = parseHevyCsv(
      csv(line({ title: '"Push, heavy"', exercise_title: '"Press ""Smith"" machine"' })),
    );
    expect(res.rows[0]?.workoutName).toBe('Push, heavy');
    expect(res.rows[0]?.exerciseName).toBe('Press "Smith" machine');
  });

  it('tolerates extra columns and a different column order', () => {
    const res = parseHevyCsv(
      [
        'exercise_title,reps,weight_kg,set_index,start_time,title,custom_col',
        'Row,10,70,0,2026-05-03 18:00:00,Pull,x',
      ].join('\n'),
    );
    expect(res.ok).toBe(true);
    expect(res.rows[0]).toMatchObject({
      exerciseName: 'Row',
      weightKg: 70,
      setOrder: 1,
      finishedAtIso: null,
    });
  });

  it('accepts an empty weight as 0 (bodyweight movement)', () => {
    const res = parseHevyCsv(csv(line({ weight_kg: '', exercise_title: 'Pull-ups' })));
    expect(res.rows[0]?.weightKg).toBe(0);
  });

  it('converts the weight_lbs header variant to kg', () => {
    const res = parseHevyCsv(
      [
        'title,start_time,exercise_title,set_index,weight_lbs,reps',
        'Push,2026-05-02 09:00:00,Bench,0,225,5',
      ].join('\n'),
    );
    expect(res.ok).toBe(true);
    expect(res.rows[0]?.weightKg).toBeCloseTo(102.06, 2);
  });

  it('accepts the older timestamp format end to end', () => {
    const res = parseHevyCsv(
      csv(line({ start_time: '"07 Jan 2024, 17:15"', end_time: '"07 Jan 2024, 18:02"' })),
    );
    expect(res.rows[0]).toMatchObject({
      dateKey: '2024-01-07',
      startedAtIso: '2024-01-07T17:15:00.000Z',
      finishedAtIso: '2024-01-07T18:02:00.000Z',
    });
  });
});

describe('parseHevyCsv malformed input', () => {
  it('rejects an unrecognized header as fatal', () => {
    const res = parseHevyCsv('foo,bar\n1,2');
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/unrecognized format/i);
    expect(res.rows).toEqual([]);
  });

  it('rejects an empty file as fatal', () => {
    expect(parseHevyCsv('').ok).toBe(false);
  });

  it('collects per-line errors with line numbers instead of throwing', () => {
    const res = parseHevyCsv(
      csv(
        line({ start_time: 'not-a-date' }), // line 2: bad start time
        line({ set_index: 'one' }), // line 3: bad set index
        line({ set_index: '1' }), // line 4: fine
        line({ set_index: '' }), // line 5: missing set index must not default
        line({ weight_kg: '9999' }), // line 6: weight above cap
        line({ exercise_title: '' }), // line 7: empty exercise
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.rows).toHaveLength(1);
    expect(res.errors.map((e) => e.line)).toEqual([2, 3, 5, 6, 7]);
  });

  it('degrades a malformed end_time to null instead of failing the row', () => {
    const res = parseHevyCsv(csv(line({ end_time: 'garbage' })));
    expect(res.errors).toEqual([]);
    expect(res.rows[0]?.finishedAtIso).toBeNull();
  });

  // Cardio rows are imported as duration/distance sets since issue #134
  // (they were skipped with a count before).
  it('maps cardio rows (duration, optional distance) onto cardio sets', () => {
    const res = parseHevyCsv(
      csv(
        line({ exercise_title: 'Running', reps: '', distance_km: '5', duration_seconds: '1800', weight_kg: '' }),
        line({ exercise_title: 'Plank', reps: '', duration_seconds: '60', weight_kg: '' }),
        line({ set_index: '1' }),
      ),
    );
    expect(res.cardioSkipped).toBe(0);
    expect(res.errors).toEqual([]);
    expect(res.rows).toHaveLength(3);
    // distance_km converted to meters; cardio convention weight 0 / reps 1.
    expect(res.rows[0]).toMatchObject({
      exerciseName: 'Running',
      setOrder: 1,
      weightKg: 0,
      reps: 1,
      durationSec: 1800,
      distanceM: 5000,
      isWarmup: false,
      isDropSet: false,
      startedAtIso: '2026-05-02T09:13:00.000Z',
    });
    expect(res.rows[1]).toMatchObject({
      exerciseName: 'Plank',
      durationSec: 60,
      distanceM: null,
    });
    // The strength row is untouched (no cardio keys at all).
    expect(res.rows[2]).not.toHaveProperty('durationSec');
    expect(res.rows[2]).toMatchObject({ weightKg: 80, reps: 8, setOrder: 2 });
  });

  it('converts cardio distance from the distance_miles header variant', () => {
    const header =
      'title,start_time,exercise_title,set_index,set_type,weight_kg,reps,distance_miles,duration_seconds';
    const res = parseHevyCsv(
      [header, 'Run Day,2026-05-02 09:13:00,Running,0,normal,,,3,1800'].join('\n'),
    );
    expect(res.errors).toEqual([]);
    expect(res.rows[0]).toMatchObject({
      durationSec: 1800,
      distanceM: +(3 * 1609.34).toFixed(2),
    });
  });

  it('still skips unrepresentable cardio rows with a count (no usable duration)', () => {
    const res = parseHevyCsv(
      csv(
        line({ exercise_title: 'Rowing', reps: '', distance_km: '5', duration_seconds: '', weight_kg: '' }),
        line({ exercise_title: 'Running', reps: '', duration_seconds: '90000', weight_kg: '' }),
      ),
    );
    expect(res.cardioSkipped).toBe(2);
    expect(res.rows).toHaveLength(0);
    expect(res.errors).toEqual([]);
  });

  it('reports a cardio row with a missing set_index as a line error', () => {
    const res = parseHevyCsv(
      csv(line({ exercise_title: 'Running', reps: '', duration_seconds: '1800', weight_kg: '', set_index: '' })),
    );
    expect(res.cardioSkipped).toBe(0);
    expect(res.rows).toHaveLength(0);
    expect(res.errors).toHaveLength(1);
  });

  it('reports a 0-rep row with no duration as an error, not cardio', () => {
    const res = parseHevyCsv(csv(line({ reps: '0' })));
    expect(res.cardioSkipped).toBe(0);
    expect(res.errors).toHaveLength(1);
  });
});

describe('parseHevyCsv caps (untrusted input)', () => {
  it('rejects a file above the size cap', () => {
    const big = 'a'.repeat(HEVY_CSV_MAX_BYTES + 1);
    const res = parseHevyCsv(big);
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/too large/i);
  });

  it('rejects a file above the row cap', () => {
    const lines = new Array(HEVY_CSV_MAX_ROWS + 1).fill('x');
    const res = parseHevyCsv(csv(...lines));
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/too many rows/i);
  });

  it('never evaluates content: a formula-looking cell is just an inert string', () => {
    const res = parseHevyCsv(csv(line({ exercise_title: '=cmd|calc' })));
    expect(res.rows[0]?.exerciseName).toBe('=cmd|calc');
  });
});
