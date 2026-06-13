import { describe, it, expect } from 'vitest';
import {
  formatCardioSet,
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
  isCardioSet,
  MAX_DURATION_SEC,
  paceSecPerKm,
  parseDurationToSec,
  speedKmh,
  sumCardioWorkingSets,
} from './cardio';

describe('isCardioSet', () => {
  it('is true only when durationSec is set', () => {
    expect(isCardioSet({ durationSec: 600 })).toBe(true);
    expect(isCardioSet({ durationSec: null })).toBe(false);
    expect(isCardioSet({})).toBe(false);
  });
});

describe('parseDurationToSec', () => {
  it('parses mm:ss', () => {
    expect(parseDurationToSec('12:30')).toBe(750);
    expect(parseDurationToSec('0:45')).toBe(45);
  });

  it('parses h:mm:ss', () => {
    expect(parseDurationToSec('1:05:00')).toBe(3900);
  });

  it('parses plain digits as minutes', () => {
    expect(parseDurationToSec('45')).toBe(2700);
    expect(parseDurationToSec(' 5 ')).toBe(300);
  });

  it('rejects invalid or out-of-bounds input', () => {
    expect(parseDurationToSec('')).toBeNull();
    expect(parseDurationToSec('abc')).toBeNull();
    expect(parseDurationToSec('12:75')).toBeNull();
    expect(parseDurationToSec('-5')).toBeNull();
    expect(parseDurationToSec('0:00')).toBeNull(); // below 1 second
    expect(parseDurationToSec('999:00:00')).toBeNull(); // over 24h
  });

  it('round-trips with formatDuration', () => {
    for (const sec of [45, 750, 3600, 3900, MAX_DURATION_SEC]) {
      expect(parseDurationToSec(formatDuration(sec))).toBe(sec);
    }
  });
});

describe('formatDuration', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatDuration(750)).toBe('12:30');
    expect(formatDuration(45)).toBe('0:45');
  });

  it('formats an hour or more as h:mm:ss', () => {
    expect(formatDuration(3900)).toBe('1:05:00');
    expect(formatDuration(3600)).toBe('1:00:00');
  });
});

describe('formatDistance', () => {
  it('renders kilometers with up to 2 decimals, trimmed', () => {
    expect(formatDistance(2500)).toBe('2.5 km');
    expect(formatDistance(10000)).toBe('10 km');
    expect(formatDistance(21097.5)).toBe('21.1 km');
  });
});

describe('formatCardioSet', () => {
  it('shows duration and distance when both are present', () => {
    expect(formatCardioSet(750, 2500)).toBe('12:30 · 2.5 km');
  });

  it('shows duration only when distance is absent or zero', () => {
    expect(formatCardioSet(750, null)).toBe('12:30');
    expect(formatCardioSet(750, 0)).toBe('12:30');
  });
});

describe('paceSecPerKm', () => {
  it('derives seconds per kilometer', () => {
    // 30:00 over 5 km -> 6:00 /km.
    expect(paceSecPerKm(1800, 5000)).toBe(360);
  });

  it('returns null for zero/absent distance (no divide-by-zero)', () => {
    expect(paceSecPerKm(1800, 0)).toBeNull();
    expect(paceSecPerKm(1800, null)).toBeNull();
    expect(paceSecPerKm(1800, undefined)).toBeNull();
  });
});

describe('speedKmh', () => {
  it('derives kilometers per hour', () => {
    // 5 km in 30:00 -> 10 km/h.
    expect(speedKmh(1800, 5000)).toBe(10);
  });

  it('returns null for zero/absent distance or zero duration', () => {
    expect(speedKmh(1800, 0)).toBeNull();
    expect(speedKmh(1800, null)).toBeNull();
    expect(speedKmh(0, 5000)).toBeNull();
  });
});

describe('formatPace', () => {
  it('formats metric pace as mm:ss /km', () => {
    expect(formatPace(1800, 5000, 'KG')).toBe('6:00 /km');
  });

  it('formats imperial pace as mm:ss /mi', () => {
    // 6:00 /km -> 6:00 * 1.60934 = 579.4 s/mi -> 9:39.
    expect(formatPace(1800, 5000, 'LB')).toBe('9:39 /mi');
  });

  it('returns null when there is no distance', () => {
    expect(formatPace(1800, 0, 'KG')).toBeNull();
    expect(formatPace(1800, null, 'LB')).toBeNull();
  });
});

describe('formatSpeed', () => {
  it('formats metric speed as km/h', () => {
    expect(formatSpeed(1800, 5000, 'KG')).toBe('10 km/h');
  });

  it('formats imperial speed as mph', () => {
    // 10 km/h -> 10 / 1.60934 = 6.21 mph -> 6.2.
    expect(formatSpeed(1800, 5000, 'LB')).toBe('6.2 mph');
  });

  it('returns null when there is no distance', () => {
    expect(formatSpeed(1800, 0, 'KG')).toBeNull();
    expect(formatSpeed(1800, null, 'LB')).toBeNull();
  });
});

describe('sumCardioWorkingSets (issue #183)', () => {
  it('excludes warmup sets from the duration and distance totals', () => {
    const sets = [
      { durationSec: 300, distanceM: 800, isWarmup: true }, // warmup, excluded
      { durationSec: 1800, distanceM: 5000, isWarmup: false },
      { durationSec: 600, distanceM: 2000, isWarmup: false },
    ];
    expect(sumCardioWorkingSets(sets)).toEqual({ durationSec: 2400, distanceM: 7000 });
  });

  it('treats absent duration/distance as 0 and handles an all-warmup list', () => {
    expect(
      sumCardioWorkingSets([{ durationSec: 1800, distanceM: null, isWarmup: false }]),
    ).toEqual({ durationSec: 1800, distanceM: 0 });
    expect(
      sumCardioWorkingSets([{ durationSec: 300, distanceM: 800, isWarmup: true }]),
    ).toEqual({ durationSec: 0, distanceM: 0 });
  });
});
