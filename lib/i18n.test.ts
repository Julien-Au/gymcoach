import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { isLocale, locales } from '@/i18n/config';
import englishMessages from '@/messages/en';
import russianMessages from '@/messages/ru';

function messageKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) =>
    messageKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n configuration', () => {
  it('recognizes only supported locales', () => {
    expect(locales).toEqual(['en', 'ru']);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ru')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('keeps every locale dictionary structurally complete', () => {
    expect(messageKeys(russianMessages).sort()).toEqual(messageKeys(englishMessages).sort());
  });

  it('uses Russian plural categories', () => {
    const t = createTranslator({ locale: 'ru', messages: russianMessages });

    expect(t('common.counts.sets', { count: 1 })).toBe('1 подход');
    expect(t('common.counts.sets', { count: 3 })).toBe('3 подхода');
    expect(t('common.counts.sets', { count: 12 })).toBe('12 подходов');
    expect(t('navigation.settings')).toBe('Настройки');
  });
});
