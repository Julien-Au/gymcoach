'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import { getExerciseMedia } from '@/lib/exercise-media';
import { useExerciseName } from '@/components/shared/use-exercise-name';

type SessionExercise = ProgramExercise & { exercise: Exercise };

interface Props {
  exercises: SessionExercise[];
  currentIndex: number;
  completedExerciseIds: ReadonlySet<string>;
  onSelect: (index: number) => void;
  disabled?: boolean;
}

function abbreviation(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return Array.from(words[0]!).slice(0, 3).join('').toUpperCase();
  return words.slice(0, 3).map((word) => Array.from(word)[0] ?? '').join('').toUpperCase();
}

export function SessionExerciseStrip({
  exercises,
  currentIndex,
  completedExerciseIds,
  onSelect,
  disabled = false,
}: Props) {
  const exerciseName = useExerciseName();
  const t = useTranslations('session');
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentIndex]);

  return (
    <div
      className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={t('exerciseStripLabel')}
    >
      <div className="flex w-max gap-2">
        {exercises.map((programExercise, index) => {
          const displayName = exerciseName(programExercise.exercise.name);
          const media = getExerciseMedia(programExercise.exercise.name);
          const isCurrent = index === currentIndex;
          const isComplete = completedExerciseIds.has(programExercise.exerciseId);

          return (
            <button
              key={programExercise.id}
              ref={isCurrent ? currentRef : undefined}
              type="button"
              onClick={() => onSelect(index)}
              disabled={disabled}
              aria-label={`${index + 1}. ${displayName}`}
              aria-current={isCurrent ? 'step' : undefined}
              title={displayName}
              className="group relative shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className={`relative block h-14 w-[4.5rem] overflow-hidden rounded-md border bg-muted transition-colors sm:h-16 sm:w-20 ${
                  isCurrent
                    ? 'border-primary ring-2 ring-primary/35'
                    : 'border-border group-hover:border-primary/50'
                }`}
              >
                {media ? (
                  <Image
                    src={media.frames[0]}
                    alt=""
                    fill
                    sizes="80px"
                    className={`object-cover transition-opacity ${isComplete ? 'opacity-55' : ''}`}
                  />
                ) : (
                  <span
                    className={`flex size-full items-center justify-center bg-secondary text-sm font-semibold text-secondary-foreground ${
                      isComplete ? 'opacity-55' : ''
                    }`}
                  >
                    {abbreviation(displayName)}
                  </span>
                )}
                {isComplete && (
                  <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                )}
              </span>
              <span
                className={`mx-auto mt-1 block h-0.5 rounded-full transition-all ${
                  isCurrent ? 'w-10 bg-primary' : 'w-0 bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

