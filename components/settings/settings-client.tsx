'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Activity, Moon, Smartphone, Sun, Volume2, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type UserPreferences,
} from '@/lib/preferences';
import { BackupSection } from './backup-section';

export function SettingsClient() {
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(loadPreferences());
    setHydrated(true);
  }, []);

  function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      savePreferences(next);
      return next;
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Appearance</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <ThemeChoice
              current={theme}
              value="dark"
              icon={<Moon className="size-4" />}
              label="Dark"
              onClick={() => setTheme('dark')}
            />
            <ThemeChoice
              current={theme}
              value="light"
              icon={<Sun className="size-4" />}
              label="Light"
              onClick={() => setTheme('light')}
            />
            <ThemeChoice
              current={theme}
              value="system"
              icon={<Monitor className="size-4" />}
              label="System"
              onClick={() => setTheme('system')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Session</h2>
          <p className="text-xs text-muted-foreground">
            These preferences are saved on this device only.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <PrefRow
            icon={<Smartphone className="size-4" />}
            label="Vibration"
            description="Set logging and end of timer."
            checked={prefs.vibration}
            onChange={(v) => update('vibration', v)}
            disabled={!hydrated}
          />
          <PrefRow
            icon={<Volume2 className="size-4" />}
            label="End of timer beep"
            description="Plays a short 880 Hz beep at the end of the rest."
            checked={prefs.restTimerSound}
            onChange={(v) => update('restTimerSound', v)}
            disabled={!hydrated}
          />
          <PrefRow
            icon={<Activity className="size-4" />}
            label="Let readiness/soreness adjust my suggested weights"
            description="When on, a recent readiness check-in can hold or lower the suggested load. When off, suggestions follow pure programmed progression."
            checked={prefs.readinessAutoRegulation}
            onChange={(v) => update('readinessAutoRegulation', v)}
            disabled={!hydrated}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Plate calculator</h2>
          <p className="text-xs text-muted-foreground">
            Bar weight and available plates per side, used by the in-workout
            plate calculator. Set the values for the unit you train in.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BarPlatesRow
            unitLabel="kg"
            barWeight={prefs.barWeightKg}
            plates={prefs.platesKg}
            onBarChange={(v) => update('barWeightKg', v)}
            onPlatesChange={(v) => update('platesKg', v)}
            disabled={!hydrated}
          />
          <BarPlatesRow
            unitLabel="lb"
            barWeight={prefs.barWeightLb}
            plates={prefs.platesLb}
            onBarChange={(v) => update('barWeightLb', v)}
            onPlatesChange={(v) => update('platesLb', v)}
            disabled={!hydrated}
          />
        </CardContent>
      </Card>

      <BackupSection />
    </>
  );
}

function BarPlatesRow({
  unitLabel,
  barWeight,
  plates,
  onBarChange,
  onPlatesChange,
  disabled,
}: {
  unitLabel: string;
  barWeight: number;
  plates: number[];
  onBarChange: (v: number) => void;
  onPlatesChange: (v: number[]) => void;
  disabled?: boolean;
}) {
  // Edit plates as comma-separated text; commit a cleaned, descending list on
  // change. Empty / invalid entries are dropped so the calculator stays sane.
  function commitPlates(raw: string) {
    const parsed = raw
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => b - a);
    onPlatesChange(parsed);
  }

  return (
    <div className="rounded-md border border-border/40 p-3">
      <p className="mb-2 text-sm font-medium">Equipment ({unitLabel})</p>
      <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <Label
            htmlFor={`bar-${unitLabel}`}
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Bar weight ({unitLabel})
          </Label>
          <Input
            id={`bar-${unitLabel}`}
            type="number"
            inputMode="decimal"
            step="0.5"
            value={barWeight}
            disabled={disabled}
            onChange={(e) => onBarChange(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={`plates-${unitLabel}`}
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Plates per side ({unitLabel})
          </Label>
          <Input
            id={`plates-${unitLabel}`}
            type="text"
            inputMode="decimal"
            defaultValue={plates.join(', ')}
            disabled={disabled}
            onBlur={(e) => commitPlates(e.target.value)}
            placeholder="e.g. 25, 20, 15, 10, 5, 2.5, 1.25"
          />
        </div>
      </div>
    </div>
  );
}

function ThemeChoice({
  current,
  value,
  icon,
  label,
  onClick,
}: {
  current: string | undefined;
  value: 'dark' | 'light' | 'system';
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const active = current === value;
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      className="min-h-tap"
    >
      {icon}
      <span className="ml-2">{label}</span>
    </Button>
  );
}

function PrefRow({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border/40 p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}
