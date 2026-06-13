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
      laps: [{ durationSec: 1800, distanceM: 5000, avgHr: 152 }],
    };

    const xml = serializeTcx(activity);
    const parsed = parseTcx(xml);

    expect(parsed.ok).toBe(true);
    expect(parsed.activity).not.toBeNull();
    expect(parsed.activity!.durationSec).toBe(1800);
    expect(parsed.activity!.distanceM).toBe(5000);
    expect(parsed.activity!.avgHr).toBe(152);
    expect(parsed.activity!.sport).toBe('Running');
    expect(parsed.activity!.startedAt.toISOString()).toBe(startedAt.toISOString());
  });

  it('round-trips multiple laps, summing duration/distance (HR duration-weighted)', () => {
    const activity: TcxExportActivity = {
      startedAt: new Date('2026-06-10T07:30:00.000Z'),
      sport: 'Biking',
      laps: [
        { durationSec: 1200, distanceM: 3000, avgHr: 150 },
        { durationSec: 600, distanceM: 2000, avgHr: 150 },
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
      laps: [{ durationSec: 900, distanceM: null, avgHr: null }],
    };
    const xml = serializeTcx(activity);
    expect(xml).not.toContain('DistanceMeters');
    expect(xml).not.toContain('AverageHeartRateBpm');
    const parsed = parseTcx(xml);
    expect(parsed.ok).toBe(true);
    expect(parsed.activity!.durationSec).toBe(900);
    expect(parsed.activity!.distanceM).toBeNull();
    expect(parsed.activity!.avgHr).toBeNull();
  });

  it('emits no DTD or entity declaration', () => {
    const xml = serializeTcx({
      startedAt: new Date('2026-06-10T07:30:00.000Z'),
      sport: 'Running',
      laps: [{ durationSec: 60, distanceM: 100, avgHr: null }],
    });
    expect(xml.toUpperCase()).not.toContain('<!DOCTYPE');
    expect(xml.toUpperCase()).not.toContain('<!ENTITY');
  });
});
