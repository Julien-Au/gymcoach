import { CalendarCheck, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { ConsistencyWeek } from '@/lib/stats';

interface Props {
  weeks: ConsistencyWeek[];
  currentStreak: number;
  weeklyFrequency: number | null;
}

function shortLabelFromWeekKey(weekKey: string) {
  // "2026-W18" -> "W18"
  const parts = weekKey.split('-W');
  return parts[1] ? `W${parts[1]}` : weekKey;
}

// Read-only consistency card: current streak plus a compact per-week bar of
// trained days over the window. On-streak weeks are filled, off weeks muted.
export function ConsistencyCard({ weeks, currentStreak, weeklyFrequency }: Props) {
  const maxTrained = Math.max(1, ...weeks.map((w) => w.trainedDays));
  const streakLabel = currentStreak === 1 ? '1 week' : `${currentStreak} weeks`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Training consistency</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {weeklyFrequency
            ? `Trained days per week over the last ${weeks.length} weeks (target ${weeklyFrequency}/week).`
            : `Trained days per week over the last ${weeks.length} weeks.`}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Flame
            className={`size-5 ${currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}
          />
          <span className="text-2xl font-bold tabular-nums">{currentStreak}</span>
          <span className="text-sm text-muted-foreground">
            current streak ({streakLabel})
          </span>
        </div>

        <div className="flex items-end gap-1" role="list" aria-label="Trained days per week">
          {weeks.map((w) => {
            const heightPct = Math.round((w.trainedDays / maxTrained) * 100);
            return (
              <div
                key={w.weekKey}
                role="listitem"
                className="flex flex-1 flex-col items-center gap-1"
                title={`${shortLabelFromWeekKey(w.weekKey)}: ${w.trainedDays} trained ${w.trainedDays === 1 ? 'day' : 'days'}`}
              >
                <div className="flex h-16 w-full items-end">
                  <div
                    className={`w-full rounded-sm ${
                      w.onStreak ? 'bg-primary' : 'bg-muted'
                    } ${w.isCurrent ? 'ring-2 ring-primary/40' : ''}`}
                    style={{ height: `${Math.max(heightPct, w.trainedDays > 0 ? 8 : 4)}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {w.trainedDays}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
