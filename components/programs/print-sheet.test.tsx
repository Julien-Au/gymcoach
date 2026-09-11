import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PrintSheetExerciseInput } from '@/lib/print-sheet';
import { PrintSheet, type PrintSheetLabels } from './print-sheet';

const labels: PrintSheetLabels = {
  date: 'Date',
  exercise: 'Exercise',
  plan: 'Plan',
  set: (n) => `Set ${n}`,
  weight: 'kg',
  reps: 'Reps',
  rir: 'RIR',
  notes: 'Notes',
  planLine: ({ sets, min, max, rir }) => `${sets} x ${min}-${max} reps, RIR ${rir}`,
  rest: (seconds) => `Rest ${seconds}s`,
  tempo: (tempo) => `Tempo ${tempo}`,
  empty: 'No exercises in this session.',
};

function pe(
  id: string,
  name: string,
  order: number,
  targetSets: number,
  extra: Partial<PrintSheetExerciseInput> = {},
): PrintSheetExerciseInput {
  return {
    id,
    order,
    supersetGroup: null,
    exercise: { name },
    targetSets,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetRIR: 2,
    restSec: 90,
    tempo: null,
    notes: null,
    ...extra,
  };
}

describe('PrintSheet', () => {
  it('renders every exercise with weight, reps and RIR empty cells per planned set', () => {
    const { container } = render(
      <PrintSheet
        programName="Hypertrophy block"
        workout={{
          id: 'w1',
          name: 'Upper A',
          exercises: [
            pe('a', 'Bench Press', 1, 4, { notes: 'Pause on the chest', tempo: '3-1-1' }),
            pe('b', 'Barbell Row', 2, 3),
            pe('c', 'Face Pull', 3, 2),
          ],
        }}
        labels={labels}
        exerciseName={(name) => name.toUpperCase()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Upper A' })).toBeInTheDocument();
    expect(screen.getByText('Hypertrophy block')).toBeInTheDocument();
    expect(screen.getByText('BENCH PRESS')).toBeInTheDocument();
    expect(screen.getByText('BARBELL ROW')).toBeInTheDocument();
    expect(screen.getByText('FACE PULL')).toBeInTheDocument();
    expect(screen.getByText('4 x 8-12 reps, RIR 2')).toBeInTheDocument();
    expect(screen.getByText('Pause on the chest')).toBeInTheDocument();
    expect(screen.getByText('Tempo 3-1-1')).toBeInTheDocument();

    // (4 + 3 + 2) sets x 3 cells, and one set column per widest exercise.
    expect(container.querySelectorAll('[data-print-cell]')).toHaveLength(27);
    expect(container.querySelectorAll('[data-print-cell="weight"]')).toHaveLength(9);
    expect(screen.getAllByRole('columnheader', { name: /^Set \d$/ })).toHaveLength(4);
    // The narrower exercises leave their extra set columns blank, not padded.
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect(rows[2]?.querySelectorAll('[data-print-cell]')).toHaveLength(6);
  });

  it('shows superset labels and an empty-session message', () => {
    render(
      <PrintSheet
        programName="Block"
        workout={{
          id: 'w2',
          name: 'Arms',
          exercises: [
            pe('a', 'Curl', 1, 3, { supersetGroup: 2 }),
            pe('b', 'Pushdown', 2, 3, { supersetGroup: 2 }),
          ],
        }}
        labels={labels}
        exerciseName={(name) => name}
      />,
    );
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();

    render(
      <PrintSheet
        programName="Block"
        workout={{ id: 'w3', name: 'Rest day', exercises: [] }}
        labels={labels}
        exerciseName={(name) => name}
      />,
    );
    expect(screen.getByText('No exercises in this session.')).toBeInTheDocument();
  });
});
