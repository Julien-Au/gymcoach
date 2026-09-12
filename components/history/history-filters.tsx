'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTrainingName } from '@/components/shared/use-training-name';

interface Props {
  programs: { id: string; name: string }[];
  selectedProgramId?: string;
  selectedMonth: string;
}

export function HistoryFilters({ programs, selectedProgramId, selectedMonth }: Props) {
  const t = useTranslations('history.filters');
  const trainingName = useTrainingName();
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateProgram(value: string | undefined) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set('programId', value);
    else params.delete('programId');
    params.set('month', selectedMonth);
    params.delete('day');
    startTransition(() => router.push(`/history?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Filter className="size-4" />
        <span>{t('title')}</span>
      </div>

      <Select
        value={selectedProgramId ?? 'all'}
        onValueChange={(value) => updateProgram(value === 'all' ? undefined : value)}
      >
        <SelectTrigger className="h-9 w-auto min-w-[10rem]" disabled={isPending}>
          <SelectValue placeholder={t('program')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allPrograms')}</SelectItem>
          {programs.map((program) => (
            <SelectItem key={program.id} value={program.id}>
              {trainingName(program.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedProgramId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => updateProgram(undefined)}
          disabled={isPending}
        >
          <X className="size-4" />
          <span className="ml-1">{t('clear')}</span>
        </Button>
      )}

      <Button variant="outline" size="sm" asChild className="ml-auto" title={t('csvTitle')}>
        <a href={buildCsvHref(selectedProgramId, selectedMonth)} download>
          <Download className="size-4" />
          <span className="ml-1">CSV</span>
        </a>
      </Button>
    </div>
  );
}

function buildCsvHref(programId: string | undefined, month: string): string {
  const params = new URLSearchParams({ month });
  if (programId) params.set('programId', programId);
  return `/api/history/csv?${params.toString()}`;
}
