import { describe, it, expect } from 'vitest';
import { currentBodyweightFromEntries } from './bodyweight';

function entry(weightKg: number, iso: string) {
  return { weightKg, measuredAt: new Date(iso) };
}

describe('currentBodyweightFromEntries', () => {
  it('returns null when there are no entries', () => {
    expect(currentBodyweightFromEntries([])).toBeNull();
  });

  it('returns the only entry weight', () => {
    expect(currentBodyweightFromEntries([entry(80, '2026-06-01')])).toBe(80);
  });

  it('returns the most recent entry regardless of array order', () => {
    const entries = [
      entry(82, '2026-06-08'),
      entry(79, '2026-05-01'),
      entry(81, '2026-06-01'),
    ];
    expect(currentBodyweightFromEntries(entries)).toBe(82);
    expect(currentBodyweightFromEntries([...entries].reverse())).toBe(82);
  });

  it('resolves a measuredAt tie to the later element (latest write wins)', () => {
    const entries = [
      entry(80, '2026-06-08T08:00:00Z'),
      entry(80.6, '2026-06-08T08:00:00Z'),
    ];
    expect(currentBodyweightFromEntries(entries)).toBe(80.6);
  });
});
