'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { VOLUME_TARGET_MAX } from '@/lib/schemas/volume-target';

interface Props {
  // The Prisma MuscleGroup enum value (e.g. "CHEST").
  muscleGroup: string;
  // Human-readable label for the muscle group.
  label: string;
  // The band currently applied to this group, and whether it is the user's
  // custom target (vs the global defaults).
  mev: number;
  mrv: number;
  custom: boolean;
  // The global defaults, shown as the reset target.
  defaultMev: number;
  defaultMrv: number;
}

// Inline editor (issue #211) for one muscle group's weekly volume target. Opens
// a dialog with mev/mrv inputs, saves via POST /api/volume-targets, and clears
// (reset to default) via DELETE. Client-side validation mirrors the Zod bounds
// (1..MAX, mrv > mev); the server re-validates regardless.
export function VolumeTargetEditor({
  muscleGroup,
  label,
  mev,
  mrv,
  custom,
  defaultMev,
  defaultMrv,
}: Props) {
  const t = useTranslations('progress.volumeTarget');
  const common = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mevValue, setMevValue] = useState(String(mev));
  const [mrvValue, setMrvValue] = useState(String(mrv));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setMevValue(String(mev));
    setMrvValue(String(mrv));
    setError(null);
  }

  function validate(): { mev: number; mrv: number } | null {
    const m = Number(mevValue);
    const r = Number(mrvValue);
    if (!Number.isInteger(m) || !Number.isInteger(r)) {
      setError(t('wholeNumbers'));
      return null;
    }
    if (m < 1 || m > VOLUME_TARGET_MAX || r < 1 || r > VOLUME_TARGET_MAX) {
      setError(t('range', { max: VOLUME_TARGET_MAX }));
      return null;
    }
    if (r <= m) {
      setError(t('order'));
      return null;
    }
    return { mev: m, mrv: r };
  }

  async function save() {
    const parsed = validate();
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/volume-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muscleGroup, mev: parsed.mev, mrv: parsed.mrv }),
      });
      if (!res.ok) {
        setError(t('saveError'));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(t('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/volume-targets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muscleGroup }),
      });
      if (!res.ok) {
        setError(t('resetError'));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(t('resetError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          {t('edit')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title', { name: label })}</DialogTitle>
          <DialogDescription>
            {t('description', {
              name: label.toLowerCase(),
              mev: defaultMev,
              mrv: defaultMrv,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor={`mev-${muscleGroup}`}>{t('mev')}</Label>
            <Input
              id={`mev-${muscleGroup}`}
              type="number"
              min={1}
              max={VOLUME_TARGET_MAX}
              value={mevValue}
              onChange={(e) => setMevValue(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor={`mrv-${muscleGroup}`}>{t('mrv')}</Label>
            <Input
              id={`mrv-${muscleGroup}`}
              type="number"
              min={1}
              max={VOLUME_TARGET_MAX}
              value={mrvValue}
              onChange={(e) => setMrvValue(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2 sm:gap-2">
          {custom && (
            <Button variant="outline" onClick={clear} disabled={busy} className="mr-auto">
              {t('reset')}
            </Button>
          )}
          <Button onClick={save} disabled={busy}>
            {common('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
