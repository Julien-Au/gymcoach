'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Check, Languages } from 'lucide-react';
import { setUserLocale } from '@/i18n/actions';
import { localeLabels, locales, type Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function LanguageSelector({ showLabel = false }: { showLabel?: boolean }) {
  const locale = useLocale();
  const t = useTranslations('common.language');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changeLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;

    startTransition(async () => {
      await setUserLocale(nextLocale);
      if ('caches' in window) {
        await window.caches.delete('pages');
      }
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? 'sm' : 'icon'}
          disabled={isPending}
          aria-label={t('change')}
        >
          <Languages className={cn('size-4', showLabel && 'mr-2')} />
          {showLabel && localeLabels[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((item) => (
          <DropdownMenuItem key={item} onSelect={() => changeLocale(item)}>
            <Check className={cn('mr-2 size-4', item !== locale && 'invisible')} />
            {item === 'en' ? t('english') : t('russian')}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
