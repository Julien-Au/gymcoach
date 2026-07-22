'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { getExerciseDisplayName } from '@/i18n/exercise-names';

export function useExerciseName(): (name: string) => string {
  const locale = useLocale();
  return useCallback((name: string) => getExerciseDisplayName(name, locale), [locale]);
}
