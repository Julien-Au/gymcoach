import { describe, it, expect } from 'vitest';
import {
  parseStrongCsv,
  STRONG_CSV_MAX_BYTES,
  STRONG_CSV_MAX_ROWS,
} from './strong-csv';

const HEADER =
  'Date,Workout Name,Exercise Name,Set Order,Weight,Reps,Distance,Seconds';

function csv(...lines: string[]) {
  return [HEADER, ...lines].join('\n');
}

describe('parseStrongCsv happy path', () => {
  it('parses working sets into normalized kg rows', () => {
    const res = parseStrongCsv(
      csv(
        '2026-05-02 09:13:00,Push Day,Bench Press (Barbell),1,80,8,0,0',
        '2026-05-02 09:13:00,Push Day,Bench Press (Barbell),2,80,7,0,0',
      ),
    );
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
      },
      {
        dateKey: '2026-05-02',
        workoutName: 'Push Day',
        exerciseName: 'Bench Press (Barbell)',
        setOrder: 2,
        weightKg: 80,
        reps: 7,
      },
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const res = parseStrongCsv(
      csv('2026-05-02,"Push, heavy","Press ""Smith"" machine",1,60,10,0,0'),
    );
    expect(res.rows[0]?.workoutName).toBe('Push, heavy');
    expect(res.rows[0]?.exerciseName).toBe('Press "Smith" machine');
  });

  it('tolerates extra columns and a different column order', () => {
    const res = parseStrongCsv(
      [
        'Workout Name,Date,Duration,Exercise Name,Set Order,Weight,Reps,RPE',
        'Pull,2026-05-03,1h,Row,1,70,10,8',
      ].join('\n'),
    );
    expect(res.ok).toBe(true);
    expect(res.rows[0]).toMatchObject({ exerciseName: 'Row', weightKg: 70 });
  });

  it('accepts an empty weight as 0 (bodyweight movement in Strong)', () => {
    const res = parseStrongCsv(csv('2026-05-02,Push,Push-up,1,,15,0,0'));
    expect(res.rows[0]?.weightKg).toBe(0);
  });
});

describe('parseStrongCsv units', () => {
  it('converts from lb when the toggle says the export is in lb', () => {
    const res = parseStrongCsv(csv('2026-05-02,Push,Bench,1,225,5,0,0'), 'LB');
    expect(res.rows[0]?.weightKg).toBeCloseTo(102.06, 2);
  });

  it('honors a kg suffix in the header over the toggle', () => {
    const res = parseStrongCsv(
      [
        'Date,Workout Name,Exercise Name,Set Order,Weight (kg),Reps',
        '2026-05-02,Push,Bench,1,80,5',
      ].join('\n'),
      'LB',
    );
    expect(res.rows[0]?.weightKg).toBe(80);
  });

  it('honors an lbs suffix in the header over the toggle', () => {
    const res = parseStrongCsv(
      [
        'Date,Workout Name,Exercise Name,Set Order,Weight (lbs),Reps',
        '2026-05-02,Push,Bench,1,225,5',
      ].join('\n'),
      'KG',
    );
    expect(res.rows[0]?.weightKg).toBeCloseTo(102.06, 2);
  });
});

describe('parseStrongCsv malformed input', () => {
  it('rejects an unrecognized header as fatal', () => {
    const res = parseStrongCsv('foo,bar\n1,2');
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/unrecognized format/i);
    expect(res.rows).toEqual([]);
  });

  it('rejects an empty file as fatal', () => {
    expect(parseStrongCsv('').ok).toBe(false);
  });

  it('collects per-line errors with line numbers instead of throwing', () => {
    const res = parseStrongCsv(
      csv(
        'not-a-date,Push,Bench,1,80,8,0,0', // line 2: bad date
        '2026-05-02,Push,Bench,one,80,8,0,0', // line 3: bad set order
        '2026-05-02,Push,Bench,2,80,8,0,0', // line 4: fine
        '2026-13-40,Push,Bench,3,80,8,0,0', // line 5: impossible date
        '2026-05-02,Push,Bench,4,9999,8,0,0', // line 6: weight above cap
        '2026-05-02,Push,,5,80,8,0,0', // line 7: empty exercise
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.rows).toHaveLength(1);
    expect(res.errors.map((e) => e.line)).toEqual([2, 3, 5, 6, 7]);
  });

  // Cardio rows are imported as duration/distance sets since issue #134
  // (they were skipped with a count before).
  it('maps cardio rows (duration, optional distance) onto cardio sets', () => {
    const res = parseStrongCsv(
      csv(
        '2026-05-02,Cardio,Running,1,0,0,5000,1800',
        '2026-05-02,Cardio,Plank,1,0,0,0,60',
        '2026-05-02,Push,Bench,1,80,8,0,0',
      ),
    );
    expect(res.cardioSkipped).toBe(0);
    expect(res.errors).toEqual([]);
    expect(res.rows).toHaveLength(3);
    // Metric export: Distance is in meters.
    expect(res.rows[0]).toEqual({
      dateKey: '2026-05-02',
      workoutName: 'Cardio',
      exerciseName: 'Running',
      setOrder: 1,
      weightKg: 0,
      reps: 1,
      durationSec: 1800,
      distanceM: 5000,
    });
    // Duration-only cardio: distance stays null.
    expect(res.rows[1]).toMatchObject({
      exerciseName: 'Plank',
      durationSec: 60,
      distanceM: null,
    });
    // The strength row is untouched (no cardio keys at all).
    expect(res.rows[2]).toEqual({
      dateKey: '2026-05-02',
      workoutName: 'Push',
      exerciseName: 'Bench',
      setOrder: 1,
      weightKg: 80,
      reps: 8,
    });
  });

  it('converts cardio distance from miles when the export unit is LB', () => {
    const res = parseStrongCsv(csv('2026-05-02,Cardio,Running,1,0,0,3,1800'), 'LB');
    expect(res.rows[0]).toMatchObject({
      durationSec: 1800,
      distanceM: +(3 * 1609.34).toFixed(2),
    });
  });

  it('still skips unrepresentable cardio rows with a count (no usable duration)', () => {
    const res = parseStrongCsv(
      csv(
        '2026-05-02,Cardio,Rowing,1,0,0,5000,0', // distance-only, no duration
        '2026-05-02,Cardio,Running,1,0,0,0,90000', // duration above the 24h cap
      ),
    );
    expect(res.cardioSkipped).toBe(2);
    expect(res.rows).toHaveLength(0);
    expect(res.errors).toEqual([]);
  });

  it('skips a cardio row whose converted distance exceeds the 1000 km cap', () => {
    const res = parseStrongCsv(csv('2026-05-02,Cardio,Cycling,1,0,0,2000000,3600'));
    expect(res.cardioSkipped).toBe(1);
    expect(res.rows).toHaveLength(0);
  });

  it('reports a cardio row with a bad set order as a line error', () => {
    const res = parseStrongCsv(csv('2026-05-02,Cardio,Running,zero,0,0,0,1800'));
    expect(res.cardioSkipped).toBe(0);
    expect(res.rows).toHaveLength(0);
    expect(res.errors).toHaveLength(1);
  });

  it('reports a 0-rep row with no duration as an error, not cardio', () => {
    const res = parseStrongCsv(csv('2026-05-02,Push,Bench,1,80,0,0,0'));
    expect(res.cardioSkipped).toBe(0);
    expect(res.errors).toHaveLength(1);
  });
});

describe('parseStrongCsv caps (untrusted input)', () => {
  it('rejects a file above the size cap', () => {
    const big = 'a'.repeat(STRONG_CSV_MAX_BYTES + 1);
    const res = parseStrongCsv(big);
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/too large/i);
  });

  it('rejects a file above the row cap', () => {
    // Tiny rows so the row cap fires before the size cap.
    const lines = new Array(STRONG_CSV_MAX_ROWS + 1).fill('x');
    const res = parseStrongCsv(csv(...lines));
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/too many rows/i);
  });

  it('never evaluates content: a formula-looking cell is just a bad row', () => {
    const res = parseStrongCsv(
      csv('2026-05-02,Push,=cmd|calc,1,80,8,0,0'),
    );
    // The exercise name is kept as an inert string, never interpreted.
    expect(res.rows[0]?.exerciseName).toBe('=cmd|calc');
  });
});
