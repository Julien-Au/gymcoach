'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Light/dark toggle button. Avoids the hydration mismatch by only showing
// the real icon after mount (next-themes recommends this pattern).
export function ThemeToggle() {
  const t = useTranslations('common.theme');
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = theme === 'system' ? resolvedTheme : theme;
  const next = current === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? t('switchToDark') : t('switchToLight')}
    >
      {!mounted ? (
        <Sun className="size-4" />
      ) : current === 'dark' ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
