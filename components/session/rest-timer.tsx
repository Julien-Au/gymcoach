'use client';

import { useEffect, useRef, useState } from 'react';
import { FastForward, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { playRestEndBeep } from '@/lib/sound';

interface Props {
  endsAt: number;
  totalSec: number;
  nextLabel: string | null | undefined;
  onEnd: () => void;
  onSkip: () => void;
  onAdd30: () => void;
}

export function RestTimer({ endsAt, totalSec, nextLabel, onEnd, onSkip, onAdd30 }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const endedRef = useRef(false);

  useEffect(() => {
    endedRef.current = false;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [endsAt]);

  // Detect reaching 0: trigger onEnd ONCE and play the beep if the preference
  // allows it.
  useEffect(() => {
    if (!endedRef.current && now >= endsAt) {
      endedRef.current = true;
      playRestEndBeep();
      onEnd();
    }
  }, [now, endsAt, onEnd]);

  const remainingMs = Math.max(0, endsAt - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const progress = Math.min(100, (remainingMs / (totalSec * 1000)) * 100);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Rest</p>

        <div className="relative">
          <p className="text-7xl font-bold tabular-nums">
            {remainingSec}
            <span className="ml-2 text-2xl text-muted-foreground">s</span>
          </p>
        </div>

        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {nextLabel && (
          <p className="text-center text-sm text-muted-foreground">
            Next: <span className="font-medium text-foreground">{nextLabel}</span>
          </p>
        )}

        <div className="flex w-full max-w-sm gap-2">
          <Button variant="outline" onClick={onAdd30} className="min-h-tap flex-1">
            <Plus className="size-4" />
            <span className="ml-1">30s</span>
          </Button>
          <Button variant="default" onClick={onSkip} className="min-h-tap flex-1">
            <FastForward className="size-4" />
            <span className="ml-1">Skip</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
