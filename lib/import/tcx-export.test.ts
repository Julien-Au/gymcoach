import { describe, it, expect } from 'vitest';
import { parseTcx } from './tcx';
import { serializeTcx, sportForExerciseName, xmlEscape, type TcxExportActivity } from './tcx-export';

describe('xmlEscape', () => {
  it('neutralizes all five XML metacharacters', () => {
    expect(xmlEscape('a & b < c > d " e \' f')).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &apos; f',
    );
  });

  it('escapes & first so introduced entities are not double-escaped', () => {
    expect(xmlEscape('<&>')).toBe('&lt;&amp;&gt;');
  });

  it('a value with markup cannot break out of its element', () => {
    const escaped = xmlEscape('</Id><script>alert(1)</script>');
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
  });
});

describe('sportForExerciseName', () => {
  it('maps the known cardio names (inverse of the import) case-insensitively', () => {
    expect(sportForExerciseName('Running')).toBe('Running');
    expect(sportForExerciseName('running')).toBe('Running');
    expect(sportForExerciseName('Cycling')).toBe('Biking');
    expect(sportForExerciseName('Rowing machine')).toBe('Other');
    expect(sportForExerciseName('Cardio (imported)')).toBe('Other');
  });
});

describe('serializeTcx round-trip', () => {
  it('round-trips a one-lap running session through the parser to the same totals', () => {
    const startedAt = new Date('2026-06-10T07:30:00.000Z');
    const activity: TcxExportActivity = {
      startedAt,
      sport: 'Running',
      laps: [{ durationSec: 1800, distanceM: 5000, avgHr: 152, maxHr: 181 }],
    };

    const xml = serializeTcx(activity);
    const parsed = parseTcx(xml);

    expect(parsed.ok).toBe(true);
    expect(parsed.activity).not.toBeNull();
    expect(parsed.activity!.durationSec).toBe(1800);
    expect(parsed.activity!.distanceM).toBe(5000);
    expect(parsed.activity!.avgHr).toBe(152);
    // Max HR survives the round-trip unchanged (issue #203).
    expect(parsed.activity!.maxHr).toBe(181);
    expect(parsed.activity!.sport).toBe('Running');
    expect(parsed.activity!.startedAt.toISOString()).toBe(startedAt.toISOString());
  });

  it('round-trips max HR as the max over laps', () => {
    const activity: TcxExportActivity = {
      startedAt: new Date('2026-06-10T07:30:00.000Z'),
      sport: 'Running',
      laps: [
        { durationSec: 600, distanceM: 2000, avgHr: 150, maxHr: 170 },
        { durationSec: 600, distanceM: 2000, avgHr: 150, maxHr: 188 },
      ],
    };
    const parsed = parseTcx(serializeTcx(activity));
    expect(parsed.ok).toBe(true);
    expect(parsed.activity!.maxHr).toBe(188);
  });

  it('round-trips multiple laps, summing duration/distance (HR duration-weighted)', () => {
    const activity: TcxExportActivity = {
      startedAt: new Date('2026-06-10T07:30:00.000Z'),
      sport: 'Biking',
      laps: [
        { durationSec: 1200, distanceM: 3000, avgHr: 150, maxHr: null },
        { durationSec: 600, distanceM: 2000, avgHr: 150, maxHr: null },
      ],
    };
    const parsed = parseTcx(serializeTcx(activity));
    expect(parsed.ok).toBe(true);
    expect(parsed.activity!.durationSec).toBe(1800);
    expect(parsed.activity!.distanceM).toBe(5000);
    expect(parsed.activity!.avgHr).toBe(150);
    expect(parsed.activity!.sport).toBe('Biking');
  });

  it('omits distance and HR for a duration-only set and still parses', () => {
    const activity: TcxExportActivity = {
      startedAt: new Date('2026-06-10T07:30:00.000Z'),
      sport: 'Other',
      laps: [{ durationSec: 900, distanceM: null, avgHr: null, maxHr: null }],
    };
    const xml = serializeTcx(activity);
    expect(xml).not.toContain('DistanceMeters');
    expect(xml).not.toContain('AverageHeartRateBpm');
    expect(xml).not.toContain('MaximumHeartRateBpm');
    const parsed = parseTcx(xml);
    expect(parsed.ok).toBe(true);
    expect(parsed.activity!.durationSec).toBe(900);
    expect(parsed.activity!.distanceM).toBeNull();
    expect(parsed.activity!.avgHr).toBeNull();
    expect(parsed.activity!.maxHr).toBeNull();
  });

  it('emits no DTD or entity declaration', () => {
    const xml = serializeTcx({
      startedAt: new Date('2026-06-10T07:30:00.000Z'),
      sport: 'Running',
      laps: [{ durationSec: 60, distanceM: 100, avgHr: null, maxHr: null }],
    });
    expect(xml.toUpperCase()).not.toContain('<!DOCTYPE');
    expect(xml.toUpperCase()).not.toContain('<!ENTITY');
  });

  it('never emits non-finite numbers or a zero HR (defensive)', () => {
    const xml = serializeTcx({
      startedAt: new Date('2026-06-10T07:30:00.000Z'),
      sport: 'Running',
      laps: [
        {
          durationSec: Number.NaN,
          distanceM: Number.POSITIVE_INFINITY,
          avgHr: 0,
          maxHr: Number.NaN,
        },
      ],
    });
    expect(xml).not.toContain('NaN');
    expect(xml).not.toContain('Infinity');
    // Distance is dropped (non-finite) and both HR blocks are omitted (avgHr 0,
    // maxHr NaN).
    expect(xml).not.toContain('DistanceMeters');
    expect(xml).not.toContain('AverageHeartRateBpm');
    expect(xml).not.toContain('MaximumHeartRateBpm');
    expect(xml).toContain('<TotalTimeSeconds>0</TotalTimeSeconds>');
  });
});
