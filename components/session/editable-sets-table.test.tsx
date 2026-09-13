import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditableSetsTable } from './editable-sets-table';

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
      }),
    );
  });

  it('uses persisted set numbers for completed rows and delete labels', () => {
    const onDeleteSet = vi.fn();
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

    render(
      <EditableSetsTable
        programExercise={programExercise}
        sets={[completedSet]}
        lastPerformance={undefined}
        readiness={null}
        deloadActive={false}
        unit="KG"
        onSubmit={vi.fn()}
        onDeleteSet={onDeleteSet}
      />,
    );

    expect(screen.getAllByText('80')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /delete set 3/i }));
    expect(onDeleteSet).toHaveBeenCalledWith(completedSet);
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
      />,
    );

    expect(screen.getByRole('button', { name: /weight/i })).toHaveTextContent('27.25');
    expect(screen.getByRole('button', { name: /repetitions/i })).toHaveTextContent('12');
    expect(screen.getAllByText('25').length).toBeGreaterThan(0);
  });

});
