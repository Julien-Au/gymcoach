'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Download, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  programs: { id: string; name: string }[];
  selectedProgramId?: string;
  selectedMonth?: string; // YYYY-MM
}

// Generates the last 12 months (including the current month) in YYYY-MM format.
function recentMonths(formatLabel: (date: Date) => string): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ value, label: formatLabel(d) });
  }
  return out;
}

export function HistoryFilters({
  programs,
  selectedProgramId,
  selectedMonth,
}: Props) {
  const t = useTranslations('history.filters');
  const format = useFormatter();
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const months = recentMonths((date) =>
    format.dateTime(date, { month: 'long', year: 'numeric' }),
  );
  const hasFilter = !!(selectedProgramId || selectedMonth);

  function update(key: 'programId' | 'month', value: string | undefined) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/history?${qs}` : '/history');
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Filter className="size-4" />
        <span>{t('title')}</span>
      </div>

      <Select
        value={selectedProgramId ?? 'all'}
        onValueChange={(v) => update('programId', v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="h-9 w-auto min-w-[10rem]">
          <SelectValue placeholder={t('program')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allPrograms')}</SelectItem>
          {programs.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedMonth ?? 'all'}
        onValueChange={(v) => update('month', v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="h-9 w-auto min-w-[9rem]">
          <SelectValue placeholder={t('month')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allMonths')}</SelectItem>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.push('/history'))}
          disabled={isPending}
        >
          <X className="size-4" />
          <span className="ml-1">{t('clear')}</span>
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        asChild
        className="ml-auto"
        title={t('csvTitle')}
      >
        <a href={buildCsvHref(selectedProgramId, selectedMonth)} download>
          <Download className="size-4" />
          <span className="ml-1">CSV</span>
        </a>
      </Button>
    </div>
  );
}

function buildCsvHref(programId?: string, month?: string): string {
  const params = new URLSearchParams();
  if (programId) params.set('programId', programId);
  if (month) params.set('month', month);
  const qs = params.toString();
  return qs ? `/api/history/csv?${qs}` : '/api/history/csv';
}
