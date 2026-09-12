import { describe, expect, it } from 'vitest';
import {
  buildMonthGrid,
  dateKeyInTimeZone,
  formatMonthKey,
  getMonthQueryRange,
  isDateKey,
  parseMonthKey,
  shiftCalendarMonth,
} from './history-calendar';

describe('history calendar helpers', () => {
  it('parses, formats and shifts month keys across year boundaries', () => {
    expect(parseMonthKey('2026-09', new Date('2000-01-01T00:00:00Z'), 'UTC')).toEqual({
      year: 2026,
      monthIndex: 8,
    });
    expect(formatMonthKey({ year: 2026, monthIndex: 8 })).toBe('2026-09');
    expect(shiftCalendarMonth({ year: 2026, monthIndex: 11 }, 1)).toEqual({
      year: 2027,
      monthIndex: 0,
    });
  });

  it('builds a fixed six-week grid with the requested week start', () => {
    const mondayGrid = buildMonthGrid({ year: 2026, monthIndex: 8 }, 1);
    expect(mondayGrid).toHaveLength(42);
    expect(mondayGrid[0]).toEqual({ dateKey: null, dayNumber: null });
    expect(mondayGrid[1]).toEqual({ dateKey: '2026-09-01', dayNumber: 1 });
    expect(mondayGrid[30]).toEqual({ dateKey: '2026-09-30', dayNumber: 30 });
    expect(mondayGrid[31]).toEqual({ dateKey: null, dayNumber: null });
  });

  it('pads the server query so client-local month boundaries are not dropped', () => {
    const range = getMonthQueryRange({ year: 2026, monthIndex: 8 });
    expect(range.gte.toISOString()).toBe('2026-08-30T12:00:00.000Z');
    expect(range.lt.toISOString()).toBe('2026-10-02T12:00:00.000Z');
  });

  it('resolves date keys in an explicit timezone', () => {
    const instant = new Date('2026-09-01T00:30:00.000Z');
    expect(dateKeyInTimeZone(instant, 'UTC')).toBe('2026-09-01');
    expect(dateKeyInTimeZone(instant, 'America/Los_Angeles')).toBe('2026-08-31');
  });

  it('validates real calendar day keys including leap years', () => {
    expect(isDateKey('2026-09-12')).toBe(true);
    expect(isDateKey('2024-02-29')).toBe(true);
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-04-31')).toBe(false);
    expect(isDateKey('2026-9-12')).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
  });

  it('uses the explicit timezone for the fallback month', () => {
    const fallback = new Date('2026-09-01T00:30:00.000Z');
    expect(parseMonthKey(undefined, fallback, 'America/Los_Angeles')).toEqual({
      year: 2026,
      monthIndex: 7,
    });
  });
});
