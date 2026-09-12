export interface CalendarMonth {
  year: number;
  monthIndex: number;
}

export interface CalendarDayCell {
  dateKey: string | null;
  dayNumber: number | null;
}

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const QUERY_PADDING_MS = 36 * 60 * 60 * 1000;

export function formatMonthKey(month: CalendarMonth): string {
  return `${month.year}-${String(month.monthIndex + 1).padStart(2, '0')}`;
}

export function parseMonthKey(value: string | undefined, fallback = new Date()): CalendarMonth {
  const match = value?.match(MONTH_PATTERN);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (year >= 1970 && year <= 9999 && monthIndex >= 0 && monthIndex <= 11) {
      return { year, monthIndex };
    }
  }

  return { year: fallback.getFullYear(), monthIndex: fallback.getMonth() };
}

export function shiftCalendarMonth(month: CalendarMonth, delta: number): CalendarMonth {
  const shifted = new Date(Date.UTC(month.year, month.monthIndex + delta, 1));
  return { year: shifted.getUTCFullYear(), monthIndex: shifted.getUTCMonth() };
}

export function buildMonthGrid(
  month: CalendarMonth,
  weekStartsOn: 0 | 1,
): CalendarDayCell[] {
  const firstWeekday = new Date(Date.UTC(month.year, month.monthIndex, 1)).getUTCDay();
  const leadingCells = (firstWeekday - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(Date.UTC(month.year, month.monthIndex + 1, 0)).getUTCDate();
  const cells: CalendarDayCell[] = [];

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - leadingCells + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      cells.push({ dateKey: null, dayNumber: null });
      continue;
    }

    cells.push({
      dateKey: `${month.year}-${String(month.monthIndex + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`,
      dayNumber,
    });
  }

  return cells;
}

export function getMonthQueryRange(month: CalendarMonth): { gte: Date; lt: Date } {
  const start = Date.UTC(month.year, month.monthIndex, 1);
  const end = Date.UTC(month.year, month.monthIndex + 1, 1);
  return {
    gte: new Date(start - QUERY_PADDING_MS),
    lt: new Date(end + QUERY_PADDING_MS),
  };
}

export function dateKeyInTimeZone(value: Date | string, timeZone?: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to resolve a calendar date.');
  }

  return `${year}-${month}-${day}`;
}

export function isDateKey(value: string | undefined): value is string {
  return Boolean(value && DATE_KEY_PATTERN.test(value));
}
