'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { CirclePlay, ExternalLink, Pause, Play, SkipBack, SkipForward, Wrench } from 'lucide-react';
import type { EquipmentType } from '@/lib/prisma-client';
import { getExerciseMedia } from '@/lib/exercise-media';
import { equipmentTypeMessageKeys } from '@/i18n/enum-keys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Props {
  exerciseName: string;
  displayName: string;
  equipmentType: EquipmentType;
  compact?: boolean;
}

export function ExerciseMediaDialog({
  exerciseName,
  displayName,
  equipmentType,
  compact = false,
}: Props) {
  const t = useTranslations('exercises.media');
  const exerciseT = useTranslations('exercises');
  const media = getExerciseMedia(exerciseName);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!open || !playing || !media) return;
    const timer = window.setInterval(() => setFrame((current) => (current === 0 ? 1 : 0)), 1400);
    return () => window.clearInterval(timer);
  }, [media, open, playing]);

  function changeOpen(value: boolean) {
    setOpen(value);
    if (value) {
      setFrame(0);
      setPlaying(true);
    }
  }

  const equipmentLabel = exerciseT(`equipmentTypes.${equipmentTypeMessageKeys[equipmentType]}`);
  const commonsUrl = `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(
    `${exerciseName} ${equipmentLabel}`,
  )}&title=Special:MediaSearch&type=image`;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-tap min-w-tap"
            aria-label={t('open', { name: displayName })}
            title={t('button')}
          >
            <CirclePlay className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-tap self-start"
            aria-label={t('open', { name: displayName })}
          >
            <CirclePlay className="size-4" />
            <span className="ml-2">{t('button')}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {media ? (
          <div className="space-y-4">
            <div className="relative aspect-[3/2] overflow-hidden rounded-md border bg-black">
              {media.frames.map((source, index) => (
                <Image
                  key={source}
                  src={source}
                  alt={t(index === 0 ? 'startAlt' : 'finishAlt', { name: displayName })}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 90vw, 560px"
                  className={`object-contain transition-opacity duration-300 ${
                    frame === index ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
              <Badge className="absolute bottom-2 left-2">
                {t(frame === 0 ? 'start' : 'finish')}
              </Badge>
              {media.approximate && (
                <Badge variant="secondary" className="absolute right-2 top-2">
                  {t('similarVariant')}
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setPlaying(false);
                  setFrame(0);
                }}
                aria-label={t('showStart')}
                title={t('showStart')}
              >
                <SkipBack className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPlaying((value) => !value)}
                aria-label={t(playing ? 'pause' : 'play')}
                title={t(playing ? 'pause' : 'play')}
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setPlaying(false);
                  setFrame(1);
                }}
                aria-label={t('showFinish')}
                title={t('showFinish')}
              >
                <SkipForward className="size-4" />
              </Button>
            </div>

            <div className="border-t pt-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Wrench className="size-4" />
                <span>{t('equipment')}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {t('equipmentDescription', { equipment: equipmentLabel })}
              </p>
            </div>

            <div className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
              <p>{t('disclaimer')}</p>
              <a
                href={media.source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
              >
                {t('source', { source: media.source.name, license: media.source.license })}
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2 text-sm">
            <p className="text-muted-foreground">{t('missing')}</p>
            <Button asChild variant="outline" size="sm">
              <a href={commonsUrl} target="_blank" rel="noreferrer">
                {t('searchCommons')}
                <ExternalLink className="ml-2 size-4" />
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
