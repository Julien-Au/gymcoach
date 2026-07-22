'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FastForward, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { playRestEndBeep } from '@/lib/sound';
import { formatWeight } from '@/lib/units';
import type { WeightUnit } from '@/lib/prisma-client';
import type { IntraSetRecommendation } from '@/lib/intra-set-autoregulation';

interface Props {
  endsAt: number;
  totalSec: number;
  nextLabel: string | null | undefined;
  recommendation?: IntraSetRecommendation | null;
  unit: WeightUnit;
  onEnd: () => void;
  onSkip: () => void;
  onAdd30: () => void;
}

export function RestTimer({
  endsAt,
  totalSec,
  nextLabel,
  recommendation = null,
  unit,
  onEnd,
  onSkip,
  onAdd30,
}: Props) {
  const t = useTranslations('session.rest');
  const autoT = useTranslations('session.autoregulation');
  const locale = useLocale();
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
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('title')}</p>

        <div className="relative">
          <p className="text-7xl font-bold tabular-nums">
            <span data-testid="rest-remaining">{remainingSec}</span>
            <span className="ml-2 text-2xl text-muted-foreground">{t('seconds')}</span>
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
            {t('next', { name: nextLabel })}
          </p>
        )}

        {recommendation && (
          <div className="w-full max-w-sm rounded-md border border-primary/30 bg-primary/5 p-3 text-center">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {autoT('nextSet')}
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatWeight(recommendation.weight, unit, {
                decimals: 2,
                group: false,
                locale,
              })}{' '}
              × {recommendation.reps} · RIR {recommendation.rir}
            </p>
            <p className="text-xs text-muted-foreground">
              {autoT(`reasons.${recommendation.reason}`)}
            </p>
          </div>
        )}

        <div className="flex w-full max-w-sm gap-2">
          <Button variant="outline" onClick={onAdd30} className="min-h-tap flex-1">
            <Plus className="size-4" />
            <span className="ml-1">{t('addThirty')}</span>
          </Button>
          <Button variant="default" onClick={onSkip} className="min-h-tap flex-1">
            <FastForward className="size-4" />
            <span className="ml-1">{t('skip')}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
