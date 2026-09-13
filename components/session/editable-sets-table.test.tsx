import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditableSetsTable } from './editable-sets-table';
import type { PendingSet } from '@/lib/indexeddb';
import type { IntraSetRecommendation } from '@/lib/intra-set-autoregulation';

const programExercise = {
  id: 'pe-1',
  exerciseId: 'exercise-1',
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetRIR: 2,
  exercise: { id: 'exercise-1', name: 'Squat', category: 'COMPOUND' },
} as never;

describe('EditableSetsTable', () => {
  it('edits and confirms the active set row through value pickers', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[]}
        lastPerformance={undefined}
        readiness={null}
        deloadActive={false}
        unit="KG"
        onSubmit={onSubmit}
        onDeleteSet={vi.fn()}
        onUpdateSet={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /weight/i }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /apply value/i }));

    fireEvent.click(screen.getByRole('button', { name: /repetitions/i }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /apply value/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /reps in reserve/i }), {
      target: { value: '1' },
    });

    expect(screen.getByText('133.3 kg')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm set 1/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        weight: 100,
        reps: 10,
        rir: 1,
        durationSec: null,
        distanceM: null,
        isWarmup: false,
        isDropSet: false,
        notes: null,
        gymEquipmentId: null,
      }),
    );
  });

  it('submits the selected gym equipment and carries it to the next set', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const firstSet = {
      localId: 'local-equipment-1',
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      gymEquipmentId: 'machine-1',
      setNumber: 1,
      weight: 80,
      reps: 8,
      rir: 2,
      notes: null,
      isWarmup: false,
      isDropSet: false,
      status: 'synced',
      serverId: 'server-equipment-1',
      syncedAt: 1,
      attempts: 0,
      lastError: null,
      createdAt: 1,
    } as PendingSet;

    render(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[firstSet]}
        lastPerformance={undefined}
        readiness={null}
        deloadActive={false}
        unit="KG"
        equipmentOptions={[
          { id: 'machine-1', name: 'Hack Squat' },
          { id: 'machine-2', name: 'Pendulum Squat' },
        ]}
        onSubmit={onSubmit}
        onDeleteSet={vi.fn()}
        onUpdateSet={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('combobox', { name: /equipment/i })).toHaveValue('machine-1');
    fireEvent.change(screen.getByRole('combobox', { name: /equipment/i }), {
      target: { value: 'machine-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm set 2/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ gymEquipmentId: 'machine-2' }),
      ),
    );
  });
  it('keeps canonical kg values when selecting a displayed lb option', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[]}
        lastPerformance={{
          sessionStartedAt: '2026-07-01T10:00:00.000Z',
          sets: [{ weight: 100, reps: 10, rir: 2 }],
          maxWeight: 100,
          repsAtMaxWeight: 10,
          cardio: null,
        }}
        readiness={null}
        deloadActive={false}
        unit="LB"
        onSubmit={onSubmit}
        onDeleteSet={vi.fn()}
        onUpdateSet={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /weight/i }));
    fireEvent.click(screen.getByRole('button', { name: /220\.5 lb/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm set 1/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ weight: 100, reps: 10, rir: 2 }),
      ),
    );
  });

  it('keeps the table horizontally scrollable at narrow widths with touch-sized active controls', () => {
    render(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[]}
        lastPerformance={undefined}
        readiness={null}
        deloadActive={false}
        unit="KG"
        onSubmit={vi.fn()}
        onDeleteSet={vi.fn()}
        onUpdateSet={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('editable-sets-scroll')).toHaveClass(
      'overflow-x-auto',
      'overscroll-x-contain',
    );
    expect(screen.getByTestId('editable-sets-grid')).toHaveClass('min-w-[31rem]');
    expect(screen.getByRole('button', { name: /set 1 weight/i })).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: /set 1 repetitions/i })).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: /confirm set 1/i })).toHaveClass('size-11');
  });

  it('uses persisted set numbers and exposes undo only for the latest completed set', () => {
    const onDeleteSet = vi.fn().mockResolvedValue(true);
    const completedSet = {
      localId: 'local-1',
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setNumber: 3,
      weight: 80,
      reps: 8,
      rir: 2,
      durationSec: null,
      distanceM: null,
      notes: null,
      isWarmup: false,
      isDropSet: false,
      status: 'synced',
      createdAt: 1,
    } as never;
    const latestSet = {
      ...(completedSet as PendingSet),
      localId: 'local-2',
      setNumber: 4,
      weight: 82.5,
      createdAt: 2,
    } as PendingSet;

    render(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[completedSet, latestSet]}
        lastPerformance={undefined}
        readiness={null}
        deloadActive={false}
        unit="KG"
        onSubmit={vi.fn()}
        onDeleteSet={onDeleteSet}
        onUpdateSet={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('button', { name: /delete set 3/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /undo set 3/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /undo set 4/i }));
    expect(onDeleteSet).toHaveBeenCalledWith(latestSet);
  });

  it('prefills active and upcoming rows from matching previous-session sets', () => {
    render(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[]}
        lastPerformance={{
          sessionStartedAt: '2026-07-01T10:00:00.000Z',
          sets: [
            { weight: 27.25, reps: 12, rir: 2 },
            { weight: 27.25, reps: 10, rir: 1 },
            { weight: 25, reps: 9, rir: 0 },
          ],
          maxWeight: 27.25,
          repsAtMaxWeight: 12,
          cardio: null,
        }}
        readiness={null}
        deloadActive={false}
        unit="KG"
        onSubmit={vi.fn()}
        onDeleteSet={vi.fn()}
        onUpdateSet={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('button', { name: /weight/i })).toHaveTextContent('27.25');
    expect(screen.getByRole('button', { name: /repetitions/i })).toHaveTextContent('12');
    expect(screen.getAllByText('25').length).toBeGreaterThan(0);
  });

  it('applies the next-set recommendation on demand and restores it after manual changes', async () => {
    const completedSet: PendingSet = {
      localId: 'local-recommendation-1',
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setNumber: 1,
      weight: 80,
      reps: 8,
      rir: 2,
      notes: null,
      isWarmup: false,
      isDropSet: false,
      status: 'synced',
      serverId: 'server-recommendation-1',
      syncedAt: 1,
      attempts: 0,
      lastError: null,
      createdAt: 1,
    };
    const recommendation: IntraSetRecommendation = {
      mode: 'PRESERVE_RIR',
      weight: 75,
      reps: 10,
      rir: 1,
      reason: 'reduce-load',
      predictedRepsAtSameLoad: 7,
      fatigueLoss: 1,
      confidence: 'medium',
    };

    const view = render(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[completedSet]}
        lastPerformance={undefined}
        readiness={null}
        deloadActive={false}
        unit="KG"
        recommendation={recommendation}
        onSubmit={vi.fn()}
        onDeleteSet={vi.fn()}
        onUpdateSet={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const applyRecommendation = screen.getByRole('button', {
      name: /apply recommendation to set 2/i,
    });
    expect(screen.getByTestId('set-recommendation-dot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set 2 weight/i })).toHaveTextContent('80');

    fireEvent.click(applyRecommendation);
    expect(screen.getByRole('button', { name: /set 2 weight/i })).toHaveTextContent('75');
    expect(screen.getByRole('button', { name: /set 2 repetitions/i })).toHaveTextContent('10');
    expect(screen.getByRole('combobox', { name: /set 2 reps in reserve/i })).toHaveValue('1');
    expect(screen.queryByTestId('set-recommendation-dot')).not.toBeInTheDocument();
    expect(applyRecommendation).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /set 2 weight/i }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '77.5' } });
    fireEvent.click(screen.getByRole('button', { name: /apply value/i }));
    expect(screen.getByTestId('set-recommendation-dot')).toBeInTheDocument();
    expect(applyRecommendation).toBeEnabled();

    const completedSet2 = {
      ...completedSet,
      localId: 'local-recommendation-2',
      setNumber: 2,
      weight: 77.5,
      reps: 9,
      rir: 1,
      createdAt: 2,
    } as never;
    view.rerender(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[completedSet, completedSet2]}
        lastPerformance={undefined}
        readiness={null}
        deloadActive={false}
        unit="KG"
        recommendation={{ ...recommendation, weight: 72.5, reps: 9, rir: 2 }}
        onSubmit={vi.fn()}
        onDeleteSet={vi.fn()}
        onUpdateSet={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /apply recommendation to set 3/i }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: /set 3 weight/i })).toHaveTextContent('77.5');
    expect(screen.getByTestId('set-recommendation-dot')).toBeInTheDocument();
  });

  it('autosaves edits to a completed set and keeps the row stable on failure', async () => {
    const completedSet = {
      localId: 'local-edit',
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setNumber: 2,
      weight: 80,
      reps: 8,
      rir: 2,
      status: 'synced',
      serverId: 'server-1',
      createdAt: 1,
    } as never;
    const onUpdateSet = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[completedSet]}
        lastPerformance={undefined}
        readiness={null}
        deloadActive={false}
        unit="KG"
        onSubmit={vi.fn()}
        onDeleteSet={vi.fn()}
        onUpdateSet={onUpdateSet}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /set 2 weight/i })[0]!);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '85' } });
    fireEvent.click(screen.getByRole('button', { name: /apply value/i }));
    await waitFor(() =>
      expect(onUpdateSet).toHaveBeenCalledWith(completedSet, { weight: 85, reps: 8, rir: 2 }),
    );

    const failedUpdate = vi.fn().mockRejectedValue(new Error('save failed'));
    rerender(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[completedSet]}
        lastPerformance={undefined}
        readiness={null}
        deloadActive={false}
        unit="KG"
        onSubmit={vi.fn()}
        onDeleteSet={vi.fn()}
        onUpdateSet={failedUpdate}
      />,
    );
    fireEvent.change(screen.getAllByRole('combobox', { name: /set 2 reps in reserve/i })[0]!, {
      target: { value: '1' },
    });
    await waitFor(() => expect(failedUpdate).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getAllByRole('combobox', { name: /set 2 reps in reserve/i })[0]).toHaveValue('2'),
    );
  });
});
