import { Trophy } from 'lucide-react';
import type { WeightUnit } from '@prisma/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatWeight } from '@/lib/units';

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

function formatDay(iso: string): string {
  // "2026-02-01" -> "Feb 1, 2026". Parsed as UTC so the day never shifts.
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

// Records board (issue #190, display-only): per strength exercise, the heaviest
// working set ever and the best estimated 1RM ever, each with the date it was
// reached. Pure derivation from existing set history (lib/records
// exerciseRecords) - no schema, API, or prompt change. Cardio and warm-ups are
// excluded upstream. Hidden by the parent until there is at least one record.
export function RecordsCard({ records, unit }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" />
          <h2 className="text-base font-semibold">Records</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          All-time bests per exercise: heaviest working set and best estimated
          1RM (Epley).
        </p>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border" role="list">
          {records.map((r) => (
            <li
              key={r.exerciseName}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
            >
              <span className="text-sm font-semibold">{r.exerciseName}</span>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Heaviest:{' '}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatWeight(r.maxWeight, unit)} x {r.maxWeightReps}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    ({formatDay(r.maxWeightDate)})
                  </span>
                </span>
                <span>
                  Best 1RM:{' '}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatWeight(r.bestE1RM, unit)}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    ({formatDay(r.bestE1RMDate)})
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
