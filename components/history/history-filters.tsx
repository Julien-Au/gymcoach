'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
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

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

// Génère les 12 derniers mois (incluant le mois courant) au format YYYY-MM.
function recentMonths(): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ value, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
}

export function HistoryFilters({
  programs,
  selectedProgramId,
  selectedMonth,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const months = recentMonths();
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
        <span>Filtres :</span>
      </div>

      <Select
        value={selectedProgramId ?? 'all'}
        onValueChange={(v) => update('programId', v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="h-9 w-auto min-w-[10rem]">
          <SelectValue placeholder="Programme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les programmes</SelectItem>
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
          <SelectValue placeholder="Mois" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les mois</SelectItem>
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
          <span className="ml-1">Effacer</span>
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        asChild
        className="ml-auto"
        title="Télécharger le CSV des séries pour les filtres actifs"
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
