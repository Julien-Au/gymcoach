'use client';

import { Check, Circle, CircleDot, CloudOff, Loader2, Trash2 } from 'lucide-react';
import type { Exercise, ProgramExercise } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PendingSet } from '@/lib/indexeddb';

interface Props {
  programExercise: ProgramExercise & { exercise: Exercise };
  sets: PendingSet[];
  isInputActive: boolean;
  onDeleteSet: (set: PendingSet) => void;
}

export function SetsList({ programExercise, sets, isInputActive, onDeleteSet }: Props) {
  const completedNonWarmup = sets.filter((s) => !s.isWarmup);
  const totalRows = Math.max(programExercise.targetSets, completedNonWarmup.length + 1);
  const currentSetNumber = completedNonWarmup.length + 1;

  return (
    <div className="rounded-lg border border-border">
      {sets.map((s) => (
        <RowDone key={s.localId} set={s} onDelete={() => onDeleteSet(s)} />
      ))}

      {Array.from({ length: totalRows - sets.length }, (_, i) => {
        const setNum = completedNonWarmup.length + 1 + i;
        const isCurrent = i === 0 && isInputActive;
        return <RowUpcoming key={`upcoming-${setNum}`} setNumber={setNum} isCurrent={isCurrent} />;
      })}

      {!isInputActive && completedNonWarmup.length === 0 && sets.length === 0 && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          Aucune série pour l&apos;instant. Le repos se termine puis tu pourras saisir la
          série {currentSetNumber}.
        </div>
      )}
    </div>
  );
}

function RowDone({ set, onDelete }: { set: PendingSet; onDelete: () => void }) {
  const weightLabel = set.weight === 0 ? 'PdC' : `${set.weight} kg`;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <SyncIcon status={set.status} />
        <span className="text-sm font-medium">
          Série {set.setNumber}
          {set.isWarmup ? ' (échauf.)' : ''}
          {set.isDropSet ? ' (drop)' : ''}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {weightLabel} × {set.reps}
          {set.rir != null && ` · RIR ${set.rir}`}
        </span>
        {set.notes && (
          <Badge variant="secondary" className="text-xs">
            note
          </Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Supprimer la série"
        className="size-8 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function SyncIcon({ status }: { status: PendingSet['status'] }) {
  if (status === 'synced') return <Check className="size-4 flex-shrink-0 text-primary" />;
  if (status === 'syncing')
    return <Loader2 className="size-4 flex-shrink-0 animate-spin text-muted-foreground" />;
  if (status === 'failed')
    return <CloudOff className="size-4 flex-shrink-0 text-amber-500" />;
  // 'pending'
  return <CloudOff className="size-4 flex-shrink-0 text-muted-foreground" />;
}

function RowUpcoming({ setNumber, isCurrent }: { setNumber: number; isCurrent: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 ${
        isCurrent ? 'bg-primary/5' : ''
      }`}
    >
      {isCurrent ? (
        <CircleDot className="size-4 flex-shrink-0 text-primary" />
      ) : (
        <Circle className="size-4 flex-shrink-0 text-muted-foreground" />
      )}
      <span className={`text-sm ${isCurrent ? 'font-medium' : 'text-muted-foreground'}`}>
        Série {setNumber} {isCurrent ? '· en cours' : '· à venir'}
      </span>
    </div>
  );
}
