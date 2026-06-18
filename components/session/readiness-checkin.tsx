'use client';

import { useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { toast } from 'sonner';
import type { MuscleGroup } from '@/lib/prisma-client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { readinessCheckinInputSchema } from '@/lib/schemas/readiness';
import { MUSCLE_GROUP_LABELS } from '@/lib/schemas/exercise';

// Optional, skippable pre-session readiness check-in (issue #38). Adds no
// friction: it is collapsed by default behind a single tap and never blocks
// starting a session. The latest check-in feeds the coach payload as an input
// signal; it does not change anything about how a session is logged.
//
// Soreness (per-muscle-group 1-5) and a free-text note are equally optional
// (issue #48): they live behind a second "Add soreness / note" toggle so the
// quick two-tap readiness + sleep path stays unchanged. Only rated groups are
// submitted, matching the partial-map semantics the schema and coach expect.

const SCALE = [1, 2, 3, 4, 5];

const MUSCLE_GROUPS = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];

export function ReadinessCheckin() {
  const [open, setOpen] = useState(false);
  const [readiness, setReadiness] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [soreness, setSoreness] = useState<Partial<Record<MuscleGroup, number>>>({});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setSorenessFor(group: MuscleGroup, value: number) {
    setSoreness((prev) => {
      // Tapping the current rating again clears it, so a group can be unrated.
      if (prev[group] === value) {
        const next = { ...prev };
        delete next[group];
        return next;
      }
      return { ...prev, [group]: value };
    });
  }

  async function submit() {
    if (readiness === null || sleepQuality === null) {
      toast.error('Rate both readiness and sleep first.');
      return;
    }
    // Only send a soreness map / note when the user actually filled them in, so
    // the quick path stays a clean { readiness, sleepQuality } payload.
    const trimmedNote = note.trim();
    const payload = {
      readiness,
      sleepQuality,
      ...(Object.keys(soreness).length > 0 ? { soreness } : {}),
      ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
    };

    // Validate locally with the same schema the route uses, so a bad note
    // length (etc.) is caught before the round-trip.
    const parsed = readinessCheckinInputSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Check-in input is invalid.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
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

        {!detailsOpen ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setDetailsOpen(true)}
          >
            Add soreness / note (optional)
          </Button>
        ) : (
          <div className="flex flex-col gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Per-muscle soreness
              </Label>
              <p className="text-xs text-muted-foreground">
                Rate only the groups that feel sore (1 fresh, 5 very sore). Tap a
                rating again to clear it.
              </p>
              <div className="flex flex-col gap-3">
                {MUSCLE_GROUPS.map((group) => (
                  <SorenessRow
                    key={group}
                    label={MUSCLE_GROUP_LABELS[group]}
                    value={soreness[group] ?? null}
                    onChange={(v) => setSorenessFor(group, v)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="readiness-note"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Note
              </Label>
              <Textarea
                id="readiness-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Anything the coach should know (optional)."
              />
            </div>
          </div>
        )}

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

function SorenessRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="grid grid-cols-5 gap-1">
        {SCALE.map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={value === n ? 'default' : 'outline'}
            onClick={() => onChange(n)}
            className="min-h-tap w-9 px-0 text-sm font-semibold"
            aria-label={`${label} soreness: ${n}`}
            aria-pressed={value === n}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}
