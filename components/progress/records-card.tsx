import { Trophy } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { WeightUnit } from '@/lib/prisma-client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatWeight } from '@/lib/units';
import { getExerciseDisplayName } from '@/i18n/exercise-names';

// One exercise's all-time bests, serialized at the Server Component boundary.
// Weights are stored in kg (bodyweight-effective load already applied upstream)
// and formatted into the user's unit here. Dates are ISO day strings.
export interface ExerciseRecordView {
  exerciseName: string;
  maxWeight: number;
  maxWeightReps: number;
  maxWeightDate: string;
  bestE1RM: number;
  bestE1RMDate: string;
}

interface Props {
  records: ExerciseRecordView[];
  unit: WeightUnit;
}

// Records board (issue #190, display-only): per strength exercise, the heaviest
// working set ever and the best estimated 1RM ever, each with the date it was
// reached. Pure derivation from existing set history (lib/records
// exerciseRecords) - no schema, API, or prompt change. Cardio and warm-ups are
// excluded upstream. Hidden by the parent until there is at least one record.
export function RecordsCard({ records, unit }: Props) {
  const t = useTranslations('progress.records');
  const locale = useLocale();
  const format = useFormatter();
  const formatDay = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00.000Z`), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" />
          <h2 className="text-base font-semibold">{t('title')}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t('description')}</p>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border" role="list">
          {records.map((r) => (
            <li key={r.exerciseName} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <span className="text-sm font-semibold">
                {getExerciseDisplayName(r.exerciseName, locale)}
              </span>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t('heaviest', {
                    value: `${formatWeight(r.maxWeight, unit, { locale })} x ${r.maxWeightReps}`,
                  })}{' '}
                  <span className="text-muted-foreground">({formatDay(r.maxWeightDate)})</span>
                </span>
                <span>
                  {t('bestOneRm', { value: formatWeight(r.bestE1RM, unit, { locale }) })}{' '}
                  <span className="text-muted-foreground">({formatDay(r.bestE1RMDate)})</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
