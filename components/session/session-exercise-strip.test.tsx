import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SessionExerciseStrip } from './session-exercise-strip';

vi.mock('@/components/shared/use-exercise-name', () => ({
  useExerciseName: () => (name: string) => name,
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const exercises = [
  {
    id: 'pe-1',
    exerciseId: 'exercise-1',
    exercise: { id: 'exercise-1', name: 'Squats · Barbell' },
  },
  {
    id: 'pe-2',
    exerciseId: 'exercise-2',
    exercise: { id: 'exercise-2', name: 'Custom Rear Delt Raise' },
  },
] as never;

describe('SessionExerciseStrip', () => {
  it('shows media when available, falls back to initials, and selects an exercise', () => {
    const onSelect = vi.fn();
    render(
      <SessionExerciseStrip
        exercises={exercises}
        currentIndex={0}
        completedExerciseIds={new Set(['exercise-1'])}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      expect.stringContaining('Barbell_Squat'),
    );
    expect(screen.getByText('CRD')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2. Custom Rear Delt Raise' }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

