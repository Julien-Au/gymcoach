'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { getTrainingDisplayName } from '@/i18n/training-names';

export function useTrainingName(): (name: string) => string {
  const locale = useLocale();
  return useCallback((name: string) => getTrainingDisplayName(name, locale), [locale]);
}
