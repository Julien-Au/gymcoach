'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Smartphone, Sun, Volume2, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
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
        </CardContent>
      </Card>

      <BackupSection />
    </>
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
