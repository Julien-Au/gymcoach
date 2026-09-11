'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Screen-only controls above a printable sheet: hidden on paper.
export function PrintSheetToolbar({ programId }: { programId: string }) {
  const t = useTranslations('programs.print');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Button asChild variant="ghost" size="sm" className="text-black hover:bg-neutral-100">
        <Link href={`/programs/${programId}`}>
          <ChevronLeft className="size-4" />
          <span className="ml-1">{t('back')}</span>
        </Link>
      </Button>
      <div className="flex items-center gap-3">
        <p className="hidden text-xs text-neutral-600 sm:block">{t('hint')}</p>
        <Button size="sm" onClick={() => window.print()} className="min-h-tap">
          <Printer className="size-4" />
          <span className="ml-2">{t('printButton')}</span>
        </Button>
      </div>
    </div>
  );
}
