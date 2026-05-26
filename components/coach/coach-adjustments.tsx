'use client';

import { useState } from 'react';
import { Check, Loader2, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import type { Adjustment } from '@/lib/coach-adjustments';
import type { ProgramExerciseDefaults } from './coach-client';

interface Props {
  debriefId: string;
  initialAdjustments: Adjustment[];
  programDefaults: Record<string, ProgramExerciseDefaults>;
  alreadyApplied: boolean;
  onApplied: (appliedAt: string) => void;
}

interface Row {
  selected: boolean;
  data: Adjustment;
}

export function CoachAdjustments({
  debriefId,
  initialAdjustments,
  programDefaults,
  alreadyApplied,
  onApplied,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialAdjustments.map((a) => {
      const def = programDefaults[a.exerciseName];
      return {
        selected: !alreadyApplied,
        data: {
          ...a,
          suggestedRepsMin: a.suggestedRepsMin ?? def?.targetRepsMin ?? null,
          suggestedRepsMax: a.suggestedRepsMax ?? def?.targetRepsMax ?? null,
          suggestedSets: a.suggestedSets ?? def?.targetSets ?? null,
          suggestedRIR: a.suggestedRIR ?? def?.targetRIR ?? null,
          suggestedRestSec: a.suggestedRestSec ?? def?.restSec ?? null,
        },
      };
    }),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (initialAdjustments.length === 0) return null;

  function patchRow(index: number, patch: Partial<Adjustment>) {
    setRows((rs) =>
      rs.map((r, i) => (i === index ? { ...r, data: { ...r.data, ...patch } } : r)),
    );
  }

  function toggleRow(index: number, selected: boolean) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, selected } : r)));
  }

  async function applyAll() {
    const selected = rows.filter((r) => r.selected).map((r) => r.data);
    if (selected.length === 0) {
      setError('Sélectionne au moins un ajustement.');
      return;
    }
    setPending(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/coach/${debriefId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustments: selected }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Erreur ${res.status}`);
      }
      const j = (await res.json()) as {
        appliedAt: string;
        applied: { exerciseName: string }[];
        skipped: { exerciseName: string; reason: string }[];
      };
      const skippedMsg =
        j.skipped.length > 0
          ? ` (${j.skipped.length} ignoré${j.skipped.length > 1 ? 's' : ''} : ${j.skipped.map((s) => s.exerciseName).join(', ')})`
          : '';
      setFeedback(
        `${j.applied.length} ajustement${j.applied.length > 1 ? 's' : ''} appliqué${j.applied.length > 1 ? 's' : ''}${skippedMsg}.`,
      );
      onApplied(j.appliedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setPending(false);
    }
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-5" />
            <h2 className="text-base font-semibold">Ajustements proposés</h2>
          </div>
          {alreadyApplied && (
            <Badge variant="secondary">Déjà appliqué</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Coche ce que tu veux appliquer au programme actif. Tu peux ajuster les
          valeurs avant de valider.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <li
              key={i}
              className={`rounded-md border p-3 transition-colors ${
                row.selected ? 'border-primary/40 bg-primary/5' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.data.exerciseName}</p>
                  <p className="text-sm">{row.data.summary}</p>
                  {row.data.rationale && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.data.rationale}
                    </p>
                  )}
                </div>
                <Switch
                  checked={row.selected}
                  onCheckedChange={(v) => toggleRow(i, v)}
                  disabled={pending}
                  aria-label={`Appliquer l'ajustement sur ${row.data.exerciseName}`}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <NumberField
                  label="Reps min"
                  value={row.data.suggestedRepsMin ?? null}
                  onChange={(v) => patchRow(i, { suggestedRepsMin: v })}
                  disabled={!row.selected || pending}
                />
                <NumberField
                  label="Reps max"
                  value={row.data.suggestedRepsMax ?? null}
                  onChange={(v) => patchRow(i, { suggestedRepsMax: v })}
                  disabled={!row.selected || pending}
                />
                <NumberField
                  label="Séries"
                  value={row.data.suggestedSets ?? null}
                  onChange={(v) => patchRow(i, { suggestedSets: v })}
                  disabled={!row.selected || pending}
                />
                <NumberField
                  label="RIR"
                  value={row.data.suggestedRIR ?? null}
                  onChange={(v) => patchRow(i, { suggestedRIR: v })}
                  disabled={!row.selected || pending}
                />
                <NumberField
                  label="Repos (s)"
                  value={row.data.suggestedRestSec ?? null}
                  onChange={(v) => patchRow(i, { suggestedRestSec: v })}
                  disabled={!row.selected || pending}
                />
                {row.data.suggestedLoad != null && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Charge cible
                    </span>
                    <span className="text-sm font-medium">
                      {row.data.suggestedLoad} kg
                      {row.data.currentLoad != null &&
                        ` (vs ${row.data.currentLoad})`}
                    </span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {feedback && <p className="text-sm text-emerald-600">{feedback}</p>}
          <Button
            type="button"
            onClick={applyAll}
            disabled={pending || selectedCount === 0}
            className="min-h-tap"
          >
            {pending ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                <span className="ml-2">Application...</span>
              </>
            ) : (
              <>
                <Check className="size-5" />
                <span className="ml-2">
                  Appliquer {selectedCount} ajustement
                  {selectedCount > 1 ? 's' : ''}
                </span>
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') onChange(null);
          else {
            const n = parseInt(raw, 10);
            onChange(Number.isNaN(n) ? null : n);
          }
        }}
        disabled={disabled}
        className="h-9 text-center text-sm"
      />
    </div>
  );
}
