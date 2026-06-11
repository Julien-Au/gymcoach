import { describe, it, expect } from 'vitest';
import {
  formatCardioSet,
  formatDistance,
  formatDuration,
  isCardioSet,
  MAX_DURATION_SEC,
  parseDurationToSec,
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
