'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BatteryCharging, BatteryLow } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { deloadReasonLine, type DeloadReason } from '@/lib/deload';

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
        toast.error(data?.error ?? 'Could not start the deload week.');
        return;
      }
      toast.success('Deload week started. Load suggestions step down for 7 days.');
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
        toast.error(data?.error ?? 'Could not end the deload.');
        return;
      }
      toast.success('Deload ended. Suggestions are back to normal progression.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (active) {
    const endDate = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(deloadUntil!));
    return (
      <Card className="border-emerald-500/50 bg-emerald-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BatteryCharging className="size-4 text-emerald-600" />
            <h2 className="text-base font-semibold">Deload week in progress</h2>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Until {endDate}, your load suggestions step down by about 10% so you
            keep moving while recovering. Normal progression resumes
            automatically afterwards.
          </p>
          <div>
            <Button variant="outline" size="sm" onClick={endDeload} disabled={busy}>
              End deload now
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
          <h2 className="text-base font-semibold">
            A deload week looks due
          </h2>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <ul className="list-disc space-y-1 pl-5">
          {reasons.map((reason) => (
            <li key={reason.kind}>{deloadReasonLine(reason)}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Accumulated fatigue can mask progress. Starting a deload week reduces
          your suggested loads by about 10% for 7 days, then normal progression
          resumes. You can end it early at any time; nothing else in your
          program changes.
        </p>
        <div>
          <Button size="sm" onClick={startDeload} disabled={busy}>
            Start a deload week
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
