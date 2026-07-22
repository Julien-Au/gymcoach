import { describe, expect, it } from 'vitest';
import { getTrainingDisplayName } from '@/i18n/training-names';

describe('getTrainingDisplayName', () => {
  it('keeps stored names unchanged in English and unsupported locales', () => {
    const name = 'Day 2 · Day 1';
    expect(getTrainingDisplayName(name, 'en')).toBe(name);
    expect(getTrainingDisplayName(name, 'de')).toBe(name);
  });

  it('localizes imported day, week and plan names for display', () => {
    expect(getTrainingDisplayName('Day 2 · Day 1', 'ru')).toBe('День 2 · День 1');
    expect(getTrainingDisplayName('Day 3 · Week 5 · New plan', 'ru')).toBe(
      'День 3 · Неделя 5 · Новый план',
    );
  });

  it('uses correct Russian week plurals and preserves date suffixes', () => {
    expect(getTrainingDisplayName('New plan · 1 week (2026-04-23)', 'ru')).toBe(
      'Новый план · 1 неделя (2026-04-23)',
    );
    expect(getTrainingDisplayName('New plan · 2 weeks', 'ru')).toBe('Новый план · 2 недели');
    expect(getTrainingDisplayName('New plan · 5 weeks', 'ru')).toBe('Новый план · 5 недель');
    expect(getTrainingDisplayName('New plan · 11 weeks', 'ru')).toBe('Новый план · 11 недель');
  });

  it('localizes common imported split names', () => {
    expect(getTrainingDisplayName('Full Body · Day 1 · Full Body Hybrid', 'ru')).toBe(
      'Всё тело · День 1 · Гибридная программа на всё тело',
    );
  });

  it('does not partially translate arbitrary user-defined names', () => {
    expect(getTrainingDisplayName('Upper body - Upper body body', 'ru')).toBe(
      'Upper body - Upper body body',
    );
  });
});
