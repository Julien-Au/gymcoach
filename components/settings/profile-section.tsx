'use client';

import { useState } from 'react';
import { Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  initialBodyweight: number | null;
}

export function ProfileSection({ initialBodyweight }: Props) {
  const [value, setValue] = useState<string>(
    initialBodyweight != null ? String(initialBodyweight) : '',
  );
  const [pending, setPending] = useState(false);

  const parsed = value === '' ? null : Number(value);
  const isValid =
    parsed === null ||
    (Number.isFinite(parsed) && parsed >= 20 && parsed <= 300);
  const dirty = (initialBodyweight ?? null) !== parsed;

  async function save() {
    if (!isValid) {
      toast.error('Invalid input (20-300 kg).');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyweight: parsed }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      toast.success('Profile updated. Volumes recalculated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <User className="size-5" />
          <h2 className="text-base font-semibold">Profile</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Your bodyweight is used to compute the effective tonnage on bodyweight
          exercises (pull-ups, dips...). The value is global: if you change it,
          past history is recalculated accordingly.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bodyweight" className="text-sm">
            Bodyweight (kg)
          </Label>
          <Input
            id="bodyweight"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="20"
            max="300"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 70"
            className="max-w-[10rem]"
          />
          {!isValid && (
            <p className="text-xs text-rose-600">Must be between 20 and 300 kg.</p>
          )}
        </div>
        <div>
          <Button
            type="button"
            onClick={save}
            disabled={pending || !dirty || !isValid}
            className="min-h-tap"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            <span className="ml-2">Save</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
