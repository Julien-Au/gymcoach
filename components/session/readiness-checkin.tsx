'use client';

import { useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// Optional, skippable pre-session readiness check-in (issue #38). Adds no
// friction: it is collapsed by default behind a single tap and never blocks
// starting a session. The latest check-in feeds the coach payload as an input
// signal; it does not change anything about how a session is logged.

const SCALE = [1, 2, 3, 4, 5];

export function ReadinessCheckin() {
  const [open, setOpen] = useState(false);
  const [readiness, setReadiness] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit() {
    if (readiness === null || sleepQuality === null) {
      toast.error('Rate both readiness and sleep first.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readiness, sleepQuality }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      toast.success('Check-in saved. The coach will factor it in.');
      setSaved(true);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the check-in.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <HeartPulse className="size-4" />
        <span className="ml-2">
          {saved ? 'Update readiness check-in' : 'Readiness check-in (optional)'}
        </span>
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="text-base font-semibold">How recovered do you feel?</h2>
        <p className="text-xs text-muted-foreground">
          Optional. Rate 1 (low) to 5 (high); the coach uses it to auto-regulate.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ScaleRow label="Overall readiness" value={readiness} onChange={setReadiness} />
        <ScaleRow label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Skip
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : 'Save check-in'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ScaleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="grid grid-cols-5 gap-2">
        {SCALE.map((n) => (
          <Button
            key={n}
            type="button"
            variant={value === n ? 'default' : 'outline'}
            onClick={() => onChange(n)}
            className="min-h-tap text-lg font-semibold"
            aria-label={`${label}: ${n}`}
            aria-pressed={value === n}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}
