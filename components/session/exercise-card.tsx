'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Lightbulb, TrendingUp } from 'lucide-react';
import type { Exercise, ProgramExercise } from '@prisma/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MUSCLE_GROUP_LABELS, CATEGORY_LABELS } from '@/lib/schemas/exercise';
import { suggestNextWeight } from '@/lib/progression';
import type { SerializedLastPerformance } from './session-runner';

interface Props {
  programExercise: ProgramExercise & { exercise: Exercise };
  lastPerformance: SerializedLastPerformance | undefined;
}

export function ExerciseCard({ programExercise, lastPerformance }: Props) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const exo = programExercise.exercise;

  const repsLabel =
    programExercise.targetRepsMin === programExercise.targetRepsMax
      ? `${programExercise.targetRepsMin}`
      : `${programExercise.targetRepsMin}-${programExercise.targetRepsMax}`;

  const suggestion = suggestNextWeight(programExercise, lastPerformance?.sets ?? []);
  const lastDate = lastPerformance
    ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(
        new Date(lastPerformance.sessionStartedAt),
      )
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-2xl font-bold tracking-tight">{exo.name}</h2>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge variant="secondary">{MUSCLE_GROUP_LABELS[exo.muscleGroup]}</Badge>
          <Badge variant="outline">{CATEGORY_LABELS[exo.category]}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        <p className="text-sm font-medium">
          {programExercise.targetSets} séries × {repsLabel} reps · RIR{' '}
          {programExercise.targetRIR} · Repos {programExercise.restSec}s
          {programExercise.tempo && ` · Tempo ${programExercise.tempo}`}
        </p>

        {lastPerformance && (
          <div className="rounded-md bg-secondary/50 p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs">Dernière séance ({lastDate})</span>
            </div>
            <p className="font-medium">
              {lastPerformance.maxWeight === 0
                ? `${lastPerformance.repsAtMaxWeight} reps poids du corps`
                : `${lastPerformance.maxWeight} kg × ${lastPerformance.repsAtMaxWeight} reps`}
            </p>
          </div>
        )}

        {suggestion.weight != null && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex items-center gap-2">
              {suggestion.reason === 'progression' ? (
                <TrendingUp className="size-4 text-primary" />
              ) : (
                <Lightbulb className="size-4 text-primary" />
              )}
              <span className="flex-1">
                Suggestion :{' '}
                <span className="font-medium">
                  {suggestion.weight === 0
                    ? 'poids du corps'
                    : `${suggestion.weight} kg`}
                </span>
                {suggestion.reason === 'progression' && suggestion.delta && (
                  <span className="ml-1 text-xs text-primary">
                    (+{suggestion.delta} kg)
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setHelpOpen((v) => !v)}
                aria-label="Comment la suggestion est calculée"
                aria-expanded={helpOpen}
                className="text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="size-4" />
              </button>
            </div>
            {helpOpen && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {suggestion.reason === 'progression'
                  ? `Toutes les séries de travail ont atteint ${suggestion.targetRepsMax} reps à ${suggestion.workingWeight} kg : on monte de ${suggestion.delta} kg pour repartir vers le bas de la fourchette (double progression).`
                  : `Garde la même charge et essaie de battre tes reps. La progression débloquera quand toutes les séries de travail atteindront ${suggestion.targetRepsMax} reps.`}
              </p>
            )}
          </div>
        )}

        {(programExercise.notes || exo.notes) && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotesOpen((v) => !v)}
              className="-ml-2"
            >
              {notesOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              <span className="ml-1">Notes / mind-muscle cue</span>
            </Button>
            {notesOpen && (
              <div className="mt-2 space-y-2 rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                {programExercise.notes && <p className="whitespace-pre-line">{programExercise.notes}</p>}
                {exo.notes && (
                  <p className="whitespace-pre-line">
                    <span className="font-medium text-foreground">Technique : </span>
                    {exo.notes}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
