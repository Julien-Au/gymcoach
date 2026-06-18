'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Target } from 'lucide-react';
import type { WeightUnit } from '@/lib/prisma-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { goalProgress, goalTargetE1RM } from '@/lib/goals';
import { formatWeight, fromDisplayWeight, roundWeight, toDisplayWeight, unitLabel } from '@/lib/units';

// One active goal per exercise, as served by the goals API. achievedAt is
// serialized to an ISO string by the Server Component boundary.
export interface GoalView {
  id: string;
  targetWeight: number; // kg (effective load for bodyweight exercises)
  targetReps: number;
  achievedAt: string | null;
}

interface Props {
  exerciseId: string;
  exerciseName: string;
  usesBodyweight: boolean;
  goal: GoalView | null;
  // Best e1RM ever logged for this exercise (kg, bodyweight-adjusted).
  bestE1RM: number;
  unit: WeightUnit;
}

export function ExerciseGoalCard({
  exerciseId,
  exerciseName,
  usesBodyweight,
  goal,
  bestE1RM,
  unit,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Dialog fields, kept in the display unit like every weight input.
  const [weightField, setWeightField] = useState('');
  const [repsField, setRepsField] = useState('');

  const target = goal
    ? { targetWeight: goal.targetWeight, targetReps: goal.targetReps }
    : null;
  const progress = target ? goalProgress(bestE1RM, target) : 0;
  const achieved = goal?.achievedAt != null;

  function openDialog() {
    setWeightField(
      goal ? String(roundWeight(toDisplayWeight(goal.targetWeight, unit), 1)) : '',
    );
    setRepsField(goal ? String(goal.targetReps) : '');
    setOpen(true);
  }

  async function saveGoal() {
    const weight = parseFloat(weightField);
    const reps = parseInt(repsField, 10);
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1) {
      toast.error('Enter a positive target weight and at least 1 rep.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId,
          targetWeight: fromDisplayWeight(weight, unit),
          targetReps: reps,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not save the goal.');
        return;
      }
      toast.success('Goal saved.');
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeGoal() {
    if (!goal) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not remove the goal.');
        return;
      }
      toast.success('Goal removed.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Target className="size-4" />
            Goal - {exerciseName}
          </h2>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openDialog}>
              {goal ? 'Edit goal' : 'Set a goal'}
            </Button>
            {goal && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeGoal}
                disabled={busy}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!goal || !target ? (
          <p className="text-sm text-muted-foreground">
            No goal set for this exercise. Set a target load and reps to track
            your progress toward it.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                Target: {formatWeight(goal.targetWeight, unit)} x {goal.targetReps}{' '}
                {goal.targetReps === 1 ? 'rep' : 'reps'}
              </span>
              {achieved && (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  Achieved
                </Badge>
              )}
            </div>
            <Progress
              value={Math.round(progress * 100)}
              aria-label="Progress toward goal"
            />
            <p className="text-xs text-muted-foreground">
              {Math.round(progress * 100)}% of the target on the estimated-1RM
              scale ({formatWeight(bestE1RM, unit)} best vs{' '}
              {formatWeight(goalTargetE1RM(target), unit)} target).
            </p>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {goal ? 'Edit the goal' : 'Set a goal'} - {exerciseName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-weight">Target load ({unitLabel(unit)})</Label>
              <Input
                id="goal-weight"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={weightField}
                onChange={(e) => setWeightField(e.target.value)}
              />
              {usesBodyweight && (
                <p className="text-xs text-muted-foreground">
                  Bodyweight exercise: enter the total effective load
                  (bodyweight + added load), like the progress charts.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-reps">Target reps</Label>
              <Input
                id="goal-reps"
                type="number"
                inputMode="numeric"
                min="1"
                value={repsField}
                onChange={(e) => setRepsField(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveGoal} disabled={busy}>
              {busy ? 'Saving...' : 'Save goal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
