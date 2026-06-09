'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Lightbulb, TrendingUp } from 'lucide-react';
import type { Exercise, MuscleGroup, ProgramExercise, WeightUnit } from '@prisma/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MUSCLE_GROUP_LABELS, CATEGORY_LABELS } from '@/lib/schemas/exercise';
import {
  suggestNextWeight,
  SORENESS_HOLD_AT_OR_ABOVE,
  type ReadinessSignal,
  type SuggestionReason,
  type SuggestionResult,
} from '@/lib/progression';
import { formatWeight } from '@/lib/units';
import type { SerializedLastPerformance } from './session-runner';

interface Props {
  programExercise: ProgramExercise & { exercise: Exercise };
  lastPerformance: SerializedLastPerformance | undefined;
  readiness: ReadinessSignal | null;
  unit: WeightUnit;
}

// Short, plain-language explainer shown next to the suggested load when a recent
// readiness/soreness check-in made the suggestion more conservative. Returns
// null for the normal (non-readiness) reasons so the UI is unchanged then. The
// note names the likelier cause - reported soreness for the trained muscle, or
// low overall readiness - so the adjustment reads as deliberate, not arbitrary.
function readinessExplainer(
  reason: SuggestionReason,
  readiness: ReadinessSignal | null,
  muscleGroup: MuscleGroup,
): string | null {
  if (reason !== 'readiness-hold' && reason !== 'readiness-deload') return null;
  const verb = reason === 'readiness-deload' ? 'Lighter' : 'Held';
  const groupSoreness = readiness?.soreness?.[muscleGroup];
  const cause =
    typeof groupSoreness === 'number' && groupSoreness >= SORENESS_HOLD_AT_OR_ABOVE
      ? 'reported soreness'
      : 'low readiness today';
  return `${verb} - ${cause}`;
}

// Long-form explanation behind the help (?) toggle, per suggestion reason.
function helpText(suggestion: SuggestionResult, unit: WeightUnit): string {
  const working = formatWeight(suggestion.workingWeight ?? 0, unit, { decimals: 2, group: false });
  switch (suggestion.reason) {
    case 'progression':
      return `All working sets reached ${suggestion.targetRepsMax} reps at ${working}: load goes up by ${formatWeight(suggestion.delta ?? 0, unit, { decimals: 2, group: false })} to drop back to the bottom of the rep range (double progression).`;
    case 'readiness-hold':
      return `A recent readiness check-in flagged poor recovery, so the load stays at ${working} instead of increasing today. Push the reps, not the weight.`;
    case 'readiness-deload':
      return `A recent readiness check-in flagged very poor recovery, so the load steps down from ${working} for a lighter session. It will climb back as recovery improves.`;
    default:
      return `Keep the same load and try to beat your reps. Progression unlocks once all working sets reach ${suggestion.targetRepsMax} reps.`;
  }
}

export function ExerciseCard({ programExercise, lastPerformance, readiness, unit }: Props) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const exo = programExercise.exercise;

  const repsLabel =
    programExercise.targetRepsMin === programExercise.targetRepsMax
      ? `${programExercise.targetRepsMin}`
      : `${programExercise.targetRepsMin}-${programExercise.targetRepsMax}`;

  const suggestion = suggestNextWeight(programExercise, lastPerformance?.sets ?? [], readiness);
  const readinessNote = readinessExplainer(suggestion.reason, readiness, exo.muscleGroup);
  const lastDate = lastPerformance
    ? new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit' }).format(
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
          {programExercise.targetSets} sets × {repsLabel} reps · RIR{' '}
          {programExercise.targetRIR} · Rest {programExercise.restSec}s
          {programExercise.tempo && ` · Tempo ${programExercise.tempo}`}
        </p>

        {lastPerformance && (
          <div className="rounded-md bg-secondary/50 p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs">Last session ({lastDate})</span>
            </div>
            <p className="font-medium">
              {lastPerformance.maxWeight === 0
                ? `${lastPerformance.repsAtMaxWeight} reps bodyweight`
                : `${formatWeight(lastPerformance.maxWeight, unit, { decimals: 2, group: false })} × ${lastPerformance.repsAtMaxWeight} reps`}
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
                Suggestion:{' '}
                <span className="font-medium">
                  {suggestion.weight === 0
                    ? 'bodyweight'
                    : formatWeight(suggestion.weight, unit, { decimals: 2, group: false })}
                </span>
                {suggestion.reason === 'progression' && suggestion.delta && (
                  <span className="ml-1 text-xs text-primary">
                    (+{formatWeight(suggestion.delta, unit, { decimals: 2, group: false })})
                  </span>
                )}
                {readinessNote && (
                  <Badge variant="secondary" className="ml-2 align-middle">
                    {readinessNote}
                  </Badge>
                )}
              </span>
              <button
                type="button"
                onClick={() => setHelpOpen((v) => !v)}
                aria-label="How the suggestion is calculated"
                aria-expanded={helpOpen}
                className="text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="size-4" />
              </button>
            </div>
            {helpOpen && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {helpText(suggestion, unit)}
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
                    <span className="font-medium text-foreground">Technique: </span>
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
