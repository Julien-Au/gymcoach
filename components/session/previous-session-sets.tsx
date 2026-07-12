'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { WeightUnit } from '@/lib/prisma-client';
import { estimate1RM } from '@/lib/stats';
import { formatWeight } from '@/lib/units';
import type { SerializedLastPerformance } from '@/components/session/session-runner';

interface Props {
  performance: SerializedLastPerformance | undefined;
  unit: WeightUnit;
}

export function PreviousSessionSets({ performance, unit }: Props) {
  const t = useTranslations('session.previousSession');
  const locale = useLocale();
  const format = useFormatter();

  if (!performance || performance.sets.length === 0) return null;

  const date = format.dateTime(new Date(performance.sessionStartedAt), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <section className="overflow-hidden rounded-md border border-border bg-muted/25">
      <div className="border-b border-border px-3 py-2">
        <h3 className="text-xs font-medium text-muted-foreground">{t('title', { date })}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[23rem] table-fixed text-center text-xs tabular-nums">
          <thead className="text-[0.6875rem] uppercase text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">{unit}</th>
              <th className="px-2 py-2 font-medium">REPS</th>
              <th className="px-2 py-2 font-medium">RIR</th>
              <th className="px-2 py-2 font-medium">1RM</th>
            </tr>
          </thead>
          <tbody>
            {performance.sets.map((set, index) => {
              const oneRm = set.weight > 0 && set.reps > 0 ? estimate1RM(set.weight, set.reps) : null;
              return (
                <tr key={`${index}-${set.weight}-${set.reps}`} className="border-t border-border/70">
                  <td className="px-2 py-2.5 text-muted-foreground">{index + 1}</td>
                  <td className="px-2 py-2.5 font-medium">
                    {formatWeight(set.weight, unit, { decimals: 2, group: false, locale })}
                  </td>
                  <td className="px-2 py-2.5 font-medium">{set.reps}</td>
                  <td className="px-2 py-2.5 font-medium">{set.rir ?? '–'}</td>
                  <td className="px-2 py-2.5 text-muted-foreground">
                    {oneRm == null
                      ? '–'
                      : formatWeight(oneRm, unit, { decimals: 1, group: false, locale })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
