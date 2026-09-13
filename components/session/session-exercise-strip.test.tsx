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
    supersetGroup: 1,
    exercise: { id: 'exercise-1', name: 'Squats · Barbell' },
  },
  {
    id: 'pe-2',
    exerciseId: 'exercise-2',
    supersetGroup: 1,
    exercise: { id: 'exercise-2', name: 'Custom Rear Delt Raise' },
  },
  {
    id: 'pe-3',
    exerciseId: 'exercise-3',
    supersetGroup: null,
    exercise: { id: 'exercise-3', name: 'Standing Calf Raise' },
  },
] as never;

describe('SessionExerciseStrip', () => {
  it('shows media, completion state, fallback initials, and selects an exercise', () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    render(
      <SessionExerciseStrip
        exercises={exercises}
        currentIndex={0}
        completedExerciseIds={new Set(['exercise-1'])}
        onSelect={onSelect}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      expect.stringContaining('Barbell_Squat'),
    );
    expect(screen.getByText('CRD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1. Squats · Barbell' })).toHaveAttribute(
      'aria-current',
      'step',
    );

    const active = screen.getByRole('button', { name: '1. Squats · Barbell' });
    const inactive = screen.getByRole('button', { name: '2. Custom Rear Delt Raise' });
    expect(active).toHaveClass('opacity-100');
    expect(inactive).toHaveClass('opacity-45');

    fireEvent.click(inactive);
    expect(onSelect).toHaveBeenCalledWith(1);
    fireEvent.click(active);
    expect(onOpen).toHaveBeenCalledWith('exercise-1');
  });

  it('connects adjacent superset exercises and leaves standalone exercises unmarked', () => {
    render(
      <SessionExerciseStrip
        exercises={exercises}
        currentIndex={0}
        completedExerciseIds={new Set()}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    const firstLine = screen
      .getByRole('button', { name: '1. Squats · Barbell' })
      .querySelector('[data-superset-group="1"]');
    const secondLine = screen
      .getByRole('button', { name: '2. Custom Rear Delt Raise' })
      .querySelector('[data-superset-group="1"]');
    const standaloneLine = screen
      .getByRole('button', { name: '3. Standing Calf Raise' })
      .querySelector('[data-superset-group]');

    expect(firstLine).toHaveClass('-mr-1', 'rounded-l-full', 'rounded-r-none');
    expect(secondLine).toHaveClass('-ml-1', 'rounded-l-none', 'rounded-r-full');
    expect(standaloneLine).not.toBeInTheDocument();
  });
});
