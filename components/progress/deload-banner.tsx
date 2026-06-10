import { BatteryLow } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { DeloadReason } from '@/lib/deload';

interface Props {
  reasons: DeloadReason[];
}

function reasonLine(reason: DeloadReason): string {
  switch (reason.kind) {
    case 'stalled-lifts': {
      const count = reason.exerciseNames.length;
      const names = reason.exerciseNames.join(', ');
      return count === 1
        ? `1 lift has stalled: ${names}.`
        : `${count} lifts have stalled: ${names}.`;
    }
    case 'low-readiness':
      return `Your readiness has averaged ${reason.averageReadiness}/5 over your last ${reason.checkins} check-ins.`;
  }
}

// Display-only banner shown on the progress page when recommendDeload fires.
// Lists the concrete reasons and explains what a deload week is; it changes
// nothing in the program or the suggestions.
export function DeloadBanner({ reasons }: Props) {
  if (reasons.length === 0) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BatteryLow className="size-4 text-amber-600" />
          <h2 className="text-base font-semibold">
            A deload week looks due
          </h2>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <ul className="list-disc space-y-1 pl-5">
          {reasons.map((reason) => (
            <li key={reason.kind}>{reasonLine(reason)}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Accumulated fatigue can mask progress. For one week, roughly halve
          your working sets or reduce the load by about 10%, keep moving, then
          resume your normal program. Your plan and suggestions are unchanged;
          this is only a recommendation.
        </p>
      </CardContent>
    </Card>
  );
}
