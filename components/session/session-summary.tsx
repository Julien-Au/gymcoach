'use client';

import { useState } from 'react';
import { ChevronLeft, Check } from 'lucide-react';
import type { Exercise, ProgramExercise, Session } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { PendingSet } from '@/lib/indexeddb';

interface Props {
  session: Session;
  sets: PendingSet[];
  programExercises: (ProgramExercise & { exercise: Exercise })[];
  onBack: () => void;
  onFinish: () => Promise<void> | void;
  finishing: boolean;
}

export function SessionSummary({ session, sets, programExercises, onBack, onFinish, finishing }: Props) {
  const [notes, setNotes] = useState(session.notes ?? '');

  const durationMin = Math.round(
    (Date.now() - new Date(session.startedAt).getTime()) / 60000,
  );
  const totalSets = sets.filter((s) => !s.isWarmup).length;
  const totalReps = sets.reduce((acc, s) => acc + s.reps, 0);
  const totalVolume = sets.reduce((acc, s) => acc + s.weight * s.reps, 0);

  const exerciseStats = programExercises.map((pe) => {
    const exoSets = sets.filter((s) => s.exerciseId === pe.exerciseId && !s.isWarmup);
    const targetSets = pe.targetSets;
    return {
      pe,
      doneSets: exoSets.length,
      targetSets,
      maxWeight: exoSets.length ? Math.max(...exoSets.map((s) => s.weight)) : 0,
      complete: exoSets.length >= targetSets,
    };
  });

  async function handleClose() {
    // Sauvegarde des notes avant clôture si elles ont changé.
    if (notes && notes !== (session.notes ?? '')) {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        toast.error('Impossible d\'enregistrer les notes.');
        return;
      }
    }
    await onFinish();
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
          <ChevronLeft className="size-4" />
          <span className="ml-1">Retour à la séance</span>
        </Button>

        <h1 className="text-2xl font-bold tracking-tight">Résumé de la séance</h1>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Durée" value={`${durationMin} min`} />
          <Stat label="Séries" value={totalSets} />
          <Stat label="Volume" value={`${Math.round(totalVolume).toLocaleString('fr-FR')} kg`} />
        </div>
        <p className="text-xs text-muted-foreground">
          Volume = Σ (charge × reps), {totalReps} répétitions au total.
        </p>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Exercices</CardTitle>
            <CardDescription>Progression par exercice</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-border">
              {exerciseStats.map((s) => (
                <li
                  key={s.pe.id}
                  className="flex items-center justify-between gap-2 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {s.complete ? (
                      <Check className="size-4 text-primary" />
                    ) : (
                      <span className="size-4 flex-shrink-0 rounded-full border border-muted-foreground/40" />
                    )}
                    <span className="truncate">{s.pe.exercise.name}</span>
                  </div>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    {s.doneSets}/{s.targetSets} séries
                    {s.maxWeight > 0 ? ` · max ${s.maxWeight} kg` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label htmlFor="session-notes">Note de séance (optionnel)</Label>
          <Textarea
            id="session-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ressenti général, douleurs, points à retravailler..."
          />
        </div>

        <Button
          onClick={handleClose}
          disabled={finishing}
          className="h-16 w-full text-base font-semibold"
        >
          {finishing ? 'Clôture en cours...' : 'Clôturer la séance'}
        </Button>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
