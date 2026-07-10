import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RestTimer } from '@/components/session/rest-timer';

describe('RestTimer next-set recommendation', () => {
  it('shows the automatically calculated next set during rest', () => {
    render(
      <RestTimer
        endsAt={Date.now() + 120_000}
        totalSec={120}
        nextLabel="Back Squat"
        recommendation={{
          mode: 'PRESERVE_REPS',
          weight: 97.5,
          reps: 12,
          rir: 2,
          reason: 'reduce-load',
          predictedRepsAtSameLoad: 11,
          fatigueLoss: 1,
          confidence: 'medium',
        }}
        unit="KG"
        onEnd={vi.fn()}
        onSkip={vi.fn()}
        onAdd30={vi.fn()}
      />,
    );

    expect(screen.getByText(/97.5 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/× 12 · RIR 2/i)).toBeInTheDocument();
  });
});
