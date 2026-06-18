'use client';

import { useState } from 'react';
import { Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import type { Sex, TrainingGoal, WeightUnit } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ProfileData {
  displayName: string | null;
  bodyweight: number | null;
  sex: Sex | null;
  heightCm: number | null;
  goal: TrainingGoal | null;
  weeklyFrequency: number | null;
  unit: WeightUnit;
}

interface Props {
  initial: ProfileData;
}

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const GOAL_OPTIONS: { value: TrainingGoal; label: string }[] = [
  { value: 'HYPERTROPHY', label: 'Hypertrophy' },
  { value: 'STRENGTH', label: 'Strength' },
  { value: 'FAT_LOSS', label: 'Fat loss' },
  { value: 'RECOMP', label: 'Recomposition' },
  { value: 'GENERAL_FITNESS', label: 'General fitness' },
];

const UNIT_OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: 'KG', label: 'Kilograms (kg)' },
  { value: 'LB', label: 'Pounds (lb)' },
];

function numOrEmpty(n: number | null): string {
  return n != null ? String(n) : '';
}

export function ProfileSection({ initial }: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? '');
  const [bodyweight, setBodyweight] = useState(numOrEmpty(initial.bodyweight));
  const [heightCm, setHeightCm] = useState(numOrEmpty(initial.heightCm));
  const [weeklyFrequency, setWeeklyFrequency] = useState(
    numOrEmpty(initial.weeklyFrequency),
  );
  const [sex, setSex] = useState<Sex | undefined>(initial.sex ?? undefined);
  const [goal, setGoal] = useState<TrainingGoal | undefined>(
    initial.goal ?? undefined,
  );
  const [unit, setUnit] = useState<WeightUnit>(initial.unit);
  const [pending, setPending] = useState(false);

  function rangeOk(value: string, min: number, max: number): boolean {
    if (value === '') return true;
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max;
  }

  const isValid =
    rangeOk(bodyweight, 20, 300) &&
    rangeOk(heightCm, 100, 250) &&
    rangeOk(weeklyFrequency, 1, 14);

  async function save() {
    if (!isValid) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setPending(true);
    try {
      const body: Record<string, unknown> = {
        displayName: displayName.trim() === '' ? null : displayName.trim(),
        bodyweight: bodyweight === '' ? null : Number(bodyweight),
        heightCm: heightCm === '' ? null : Number(heightCm),
        weeklyFrequency: weeklyFrequency === '' ? null : Number(weeklyFrequency),
      };
      if (sex) body.sex = sex;
      if (goal) body.goal = goal;
      body.unit = unit;

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      toast.success('Profile updated.');
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
          Your profile tailors the AI coach. Bodyweight is also used to compute
          the effective tonnage on bodyweight exercises (pull-ups, dips...);
          changing it recalculates past history accordingly.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="displayName" className="text-sm">
            Name
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
            className="max-w-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bodyweight" className="text-sm">
              Bodyweight (kg)
            </Label>
            <Input
              id="bodyweight"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={bodyweight}
              onChange={(e) => setBodyweight(e.target.value)}
              placeholder="e.g. 75"
            />
            {!rangeOk(bodyweight, 20, 300) && (
              <p className="text-xs text-rose-600">Between 20 and 300 kg.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="heightCm" className="text-sm">
              Height (cm)
            </Label>
            <Input
              id="heightCm"
              type="number"
              inputMode="numeric"
              step="1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="e.g. 178"
            />
            {!rangeOk(heightCm, 100, 250) && (
              <p className="text-xs text-rose-600">Between 100 and 250 cm.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Sex</Label>
            <Select value={sex} onValueChange={(v) => setSex(v as Sex)}>
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                {SEX_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="weeklyFrequency" className="text-sm">
              Sessions / week
            </Label>
            <Input
              id="weeklyFrequency"
              type="number"
              inputMode="numeric"
              step="1"
              value={weeklyFrequency}
              onChange={(e) => setWeeklyFrequency(e.target.value)}
              placeholder="e.g. 3"
            />
            {!rangeOk(weeklyFrequency, 1, 14) && (
              <p className="text-xs text-rose-600">Between 1 and 14.</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Goal</Label>
          <Select value={goal} onValueChange={(v) => setGoal(v as TrainingGoal)}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              {GOAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Weight unit</Label>
          <Select value={unit} onValueChange={(v) => setUnit(v as WeightUnit)}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Changes how weights are shown and entered. Your data is always stored
            in kg, so switching never alters past sessions.
          </p>
        </div>

        <div>
          <Button
            type="button"
            onClick={save}
            disabled={pending || !isValid}
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
