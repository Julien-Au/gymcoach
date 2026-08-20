'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import type { BodyView, HeatLevel, MuscleMapRegion } from '@/lib/muscle-map';
import { BODY_OUTLINE_PATHS, BODY_VIEWBOX, REGION_PATHS } from './body-paths';

// Fill ramp for the four heat levels. Sequential warm ramp (amber to deep
// red) validated for CVD and normal-vision separation in both themes; the
// gray 'none' state is deliberately desaturated so untouched reads as absent.
const LEVEL_FILL: Record<HeatLevel, string> = {
  none: 'fill-muted',
  low: 'fill-amber-300',
  optimal: 'fill-orange-500 dark:fill-orange-400',
  high: 'fill-red-700 dark:fill-red-500',
};

const LEGEND_LEVELS: readonly HeatLevel[] = ['none', 'low', 'optimal', 'high'];

interface Props {
  regions: MuscleMapRegion[];
  // Preformatted label of the week the map describes (same week as the
  // volume-landmarks card).
  weekLabel: string;
}

// Muscle heat map (issue #299): front/back silhouettes tinted by this week's
// working sets against each muscle's MEV/MRV band. Identity is never color
// alone: every region carries an accessible label with the set count, and
// tapping/hovering a region prints it below the figures.
export function MuscleMapCard({ regions, weekLabel }: Props) {
  const t = useTranslations('progress.muscleMap');
  const exerciseT = useTranslations('exercises');
  const [selected, setSelected] = useState<MuscleMapRegion | null>(null);

  const trained = regions.some((r) => r.level !== 'none');

  function regionLabel(region: MuscleMapRegion): string {
    return t('regionLabel', {
      name: exerciseT(`muscleGroups.${muscleGroupMessageKeys[region.group]}`),
      sets: region.sets,
      status: t(`status.${region.level}`),
    });
  }

  function renderView(view: BodyView) {
    return (
      <svg
        viewBox={BODY_VIEWBOX}
        // role="group", not "img": an img SVG prunes its descendants from the
        // accessibility tree, which would silence the per-region labels.
        role="group"
        aria-label={t(view)}
        className="h-auto w-full max-w-[180px]"
      >
        {BODY_OUTLINE_PATHS.map((d) => (
          <path key={d} d={d} className="fill-muted/40" />
        ))}
        {regions
          .filter((r) => r.view === view)
          .map((region) => (
            <path
              key={region.regionId}
              d={REGION_PATHS[view][region.regionId]}
              className={`${LEVEL_FILL[region.level]} stroke-background cursor-pointer focus:outline-none focus-visible:stroke-ring`}
              strokeWidth={2}
              role="img"
              aria-label={regionLabel(region)}
              tabIndex={0}
              onClick={() => setSelected(region)}
              onFocus={() => setSelected(region)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelected(region);
              }}
              onMouseEnter={() => setSelected(region)}
            >
              <title>{regionLabel(region)}</title>
            </path>
          ))}
      </svg>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">{t('title')}</h2>
        <p className="text-xs text-muted-foreground">{t('description', { week: weekLabel })}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <figure className="flex flex-col items-center">
            {renderView('front')}
            <figcaption className="text-xs text-muted-foreground">{t('front')}</figcaption>
          </figure>
          <figure className="flex flex-col items-center">
            {renderView('back')}
            <figcaption className="text-xs text-muted-foreground">{t('back')}</figcaption>
          </figure>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-hidden="true">
          {LEGEND_LEVELS.map((level) => (
            <span key={level} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg viewBox="0 0 12 12" className="size-3">
                <rect width="12" height="12" rx="3" className={LEVEL_FILL[level]} />
              </svg>
              {t(`legend.${level}`)}
            </span>
          ))}
        </div>

        <p className="min-h-5 text-sm" data-testid="muscle-map-detail">
          {selected ? regionLabel(selected) : trained ? t('hint') : t('empty')}
        </p>
      </CardContent>
    </Card>
  );
}
