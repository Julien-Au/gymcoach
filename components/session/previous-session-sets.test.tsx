import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PreviousSessionSets } from './previous-session-sets';

describe('PreviousSessionSets', () => {
  it('renders previous sets with a dedicated RIR column', () => {
    render(
      <PreviousSessionSets
        unit="KG"
        performance={{
          sessionStartedAt: '2026-07-01T10:00:00.000Z',
          sets: [{ weight: 80, reps: 8, rir: 2 }],
          maxWeight: 80,
          repsAtMaxWeight: 8,
          cardio: null,
        }}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'RIR' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '101.3 kg' })).toBeInTheDocument();
  });
});
