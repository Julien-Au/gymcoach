import { describe, it, expect } from 'vitest';
import { AVG_HR_MAX, AVG_HR_MIN, MAX_DISTANCE_M, MAX_DURATION_SEC } from '@/lib/cardio';
import { cleanTrackPoint, downsampleTrack, MAX_TRACK_POINTS } from './track';

// The shared sanitizer for imported activity tracks (FIT, GPX, TCX all feed it).
// Its bounds are the gate between an untrusted file and what gets stored on the
// cardio set and rendered in the heart-rate chart, so they are tested directly
// here (not just indirectly through in-range importer fixtures).

describe('cleanTrackPoint (issues #254/#259)', () => {
  it('keeps a fully valid point, rounding t and hr and trimming distance to cm', () => {
    expect(cleanTrackPoint(12.6, 1234.567, 150.4)).toEqual({ t: 13, d: 1234.57, hr: 150 });
  });

  it('keeps a time-only point (no distance, no heart rate)', () => {
    expect(cleanTrackPoint(30, null, null)).toEqual({ t: 30 });
    expect(cleanTrackPoint(30, undefined, undefined)).toEqual({ t: 30 });
  });

  it('drops the whole point when the time is invalid or out of window', () => {
    expect(cleanTrackPoint(-1, 100, 150)).toBeNull(); // before the start
    expect(cleanTrackPoint(MAX_DURATION_SEC + 1, 100, 150)).toBeNull(); // past 24h
    expect(cleanTrackPoint(NaN, 100, 150)).toBeNull();
    expect(cleanTrackPoint(Infinity, 100, 150)).toBeNull();
  });

  it('accepts t at the window edges', () => {
    expect(cleanTrackPoint(0, null, null)).toEqual({ t: 0 });
    expect(cleanTrackPoint(MAX_DURATION_SEC, null, null)).toEqual({ t: MAX_DURATION_SEC });
  });

  it('drops an out-of-range or non-finite distance but keeps the point', () => {
    expect(cleanTrackPoint(10, -5, null)).toEqual({ t: 10 }); // negative distance dropped
    expect(cleanTrackPoint(10, MAX_DISTANCE_M + 1, null)).toEqual({ t: 10 }); // > 1000 km dropped
    expect(cleanTrackPoint(10, NaN, null)).toEqual({ t: 10 });
    expect(cleanTrackPoint(10, Infinity, null)).toEqual({ t: 10 });
    expect(cleanTrackPoint(10, 0, null)).toEqual({ t: 10, d: 0 }); // zero distance is valid
  });

  it('drops an out-of-range or non-finite heart rate but keeps the point', () => {
    expect(cleanTrackPoint(10, null, AVG_HR_MIN - 1)).toEqual({ t: 10 }); // below 40 dropped
    expect(cleanTrackPoint(10, null, AVG_HR_MAX + 1)).toEqual({ t: 10 }); // above 250 dropped
    expect(cleanTrackPoint(10, null, 9999)).toEqual({ t: 10 }); // hostile value dropped
    expect(cleanTrackPoint(10, null, NaN)).toEqual({ t: 10 });
    expect(cleanTrackPoint(10, null, AVG_HR_MIN)).toEqual({ t: 10, hr: AVG_HR_MIN }); // edge kept
    expect(cleanTrackPoint(10, null, AVG_HR_MAX)).toEqual({ t: 10, hr: AVG_HR_MAX }); // edge kept
  });

  it('only ever produces numeric fields (no strings reach the stored JSON)', () => {
    const p = cleanTrackPoint(5, 10, 120)!;
    for (const v of Object.values(p)) expect(typeof v).toBe('number');
  });
});

describe('downsampleTrack', () => {
  it('returns null for an empty list', () => {
    expect(downsampleTrack([])).toBeNull();
  });

  it('returns the points unchanged when already under the cap', () => {
    const pts = [
      { t: 0, d: 0, hr: 140 },
      { t: 1, d: 5, hr: 142 },
    ];
    expect(downsampleTrack(pts)).toEqual(pts);
  });

  it('caps a long track at MAX_TRACK_POINTS, evenly strided from the first point', () => {
    const pts = Array.from({ length: 1700 }, (_, i) => ({ t: i, d: i * 2, hr: 150 }));
    const out = downsampleTrack(pts)!;
    expect(out.length).toBeGreaterThan(1);
    expect(out.length).toBeLessThanOrEqual(MAX_TRACK_POINTS);
    expect(out.length).toBeLessThan(pts.length);
    expect(out[0]).toEqual({ t: 0, d: 0, hr: 150 });
    // Evenly strided: the gap between kept points is constant.
    const stride = out[1]!.t - out[0]!.t;
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.t - out[i - 1]!.t).toBe(stride);
    }
  });
});
