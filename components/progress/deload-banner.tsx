'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { BatteryCharging, BatteryLow } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { deloadReasonLine, type DeloadReason } from '@/lib/deload';
import { useExerciseName } from '@/components/shared/use-exercise-name';

interface Props {
  reasons: DeloadReason[];
  // End of the active planned deload week (ISO string), or null when none is
  // running. The server only passes a future timestamp here.
  deloadUntil: string | null;
}

// Banner shown on the progress page when recommendDeload fires or a planned
// deload week is running (issue #112). One tap starts the deload week (the
// suggestion engine then steps loads down ~10%); while active it shows the end
// date and lets the user end it early.
export function DeloadBanner({ reasons, deloadUntil }: Props) {
  const t = useTranslations('progress.deload');
  const format = useFormatter();
  const exerciseName = useExerciseName();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = deloadUntil != null;

  if (!active && reasons.length === 0) return null;

  async function startDeload() {
    setBusy(true);
    try {
      const res = await fetch('/api/deload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('startError'));
        return;
      }
      toast.success(t('started'));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function endDeload() {
    setBusy(true);
    try {
      const res = await fetch('/api/deload', { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('endError'));
        return;
      }
      toast.success(t('ended'));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (active) {
    const endDate = format.dateTime(new Date(deloadUntil!), {
      day: '2-digit',
      month: 'short',
    });
    return (
      <Card className="border-emerald-500/50 bg-emerald-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BatteryCharging className="size-4 text-emerald-600" />
            <h2 className="text-base font-semibold">{t('activeTitle')}</h2>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">{t('activeDescription', { date: endDate })}</p>
          <div>
            <Button variant="outline" size="sm" onClick={endDeload} disabled={busy}>
              {t('end')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BatteryLow className="size-4 text-amber-600" />
          <h2 className="text-base font-semibold">{t('dueTitle')}</h2>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <ul className="list-disc space-y-1 pl-5">
          {reasons.map((reason) => (
            <li key={reason.kind}>
              {deloadReasonLine(
                reason.kind === 'stalled-lifts'
                  ? {
                      ...reason,
                      exerciseNames: reason.exerciseNames.map(exerciseName),
                    }
                  : reason,
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t('dueDescription')}</p>
        <div>
          <Button size="sm" onClick={startDeload} disabled={busy}>
            {t('start')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
