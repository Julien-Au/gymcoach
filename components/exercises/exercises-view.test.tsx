import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Exercise } from '@/lib/prisma-client';
import { ExercisesView } from './exercises-view';

// The catalog renders the create/edit dialogs and the delete button, which call
// useRouter; mock it so the component mounts under jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

function exercise(over: Partial<Exercise>): Exercise {
  return {
    id: over.id ?? 'e1',
    userId: 'u',
    name: over.name ?? 'Exercise',
    muscleGroup: over.muscleGroup ?? 'CHEST',
    category: over.category ?? 'COMPOUND',
    defaultRestSec: 120,
    notes: null,
    usesBodyweight: false,
    equipmentType: over.equipmentType ?? 'OTHER',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

const exercises: Exercise[] = [
  exercise({ id: 'e1', name: 'Barbell Bench Press', muscleGroup: 'CHEST' }),
  exercise({ id: 'e2', name: 'Back Squat', muscleGroup: 'QUADS' }),
  exercise({ id: 'e3', name: 'Romanian Deadlift', muscleGroup: 'HAMSTRINGS' }),
];

describe('ExercisesView search (issue #238)', () => {
  it('shows every exercise when the query is empty', () => {
    render(<ExercisesView exercises={exercises} />);
    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByText('Romanian Deadlift')).toBeInTheDocument();
  });

  it('narrows the list to name matches, case-insensitively', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ExercisesView exercises={exercises} />);
    await user.type(screen.getByLabelText('Search exercises by name'), 'squat');
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.queryByText('Barbell Bench Press')).not.toBeInTheDocument();
    expect(screen.queryByText('Romanian Deadlift')).not.toBeInTheDocument();
  });

  it('shows a no-match empty state when nothing matches', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ExercisesView exercises={exercises} />);
    await user.type(screen.getByLabelText('Search exercises by name'), 'zzz');
    expect(screen.getByText('No exercises match')).toBeInTheDocument();
    expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
  });

  it('restores the full list when the query is cleared', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ExercisesView exercises={exercises} />);
    const input = screen.getByLabelText('Search exercises by name');
    await user.type(input, 'squat');
    expect(screen.queryByText('Barbell Bench Press')).not.toBeInTheDocument();
    await user.clear(input);
    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Romanian Deadlift')).toBeInTheDocument();
  });

  it('renders the catalog-empty state and no search box when there are no exercises', () => {
    render(<ExercisesView exercises={[]} />);
    expect(screen.getByText('No exercises')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search exercises by name')).not.toBeInTheDocument();
  });
});

describe('ExercisesView catalog card at mobile width (issue #330)', () => {
  it('renders the full name in a wrapping (not truncating) element', () => {
    render(
      <ExercisesView
        exercises={[exercise({ id: 'e1', name: 'Incline dumbbell bench press with a pause' })]}
      />,
    );
    const name = screen.getByText('Incline dumbbell bench press with a pause');
    expect(name).toHaveClass('line-clamp-2');
    expect(name).not.toHaveClass('truncate');
  });

  it('labels the equipment with the compact form, not the long badge text', () => {
    render(<ExercisesView exercises={[exercise({ id: 'e1', equipmentType: 'OTHER' })]} />);
    // Equipment and rest form one non-wrapping unit, so the separator cannot orphan.
    const label = screen.getByText('Any equipment');
    expect(label.parentElement).toHaveClass('whitespace-nowrap');
    expect(label.parentElement).toHaveTextContent('Any equipment · rest 120s');
    expect(screen.queryByText('Other / unrestricted')).not.toBeInTheDocument();
  });

  it('gives every card the same fixed-size technique slot, with or without media', () => {
    render(
      <ExercisesView
        exercises={[
          exercise({ id: 'e1', name: 'Barbell Bench Press' }),
          exercise({ id: 'e2', name: 'Future custom movement' }),
        ]}
      />,
    );
    const withMedia = screen.getByRole('button', { name: 'View technique for Barbell Bench Press' });
    const withoutMedia = screen.getByRole('button', {
      name: 'View technique for Future custom movement',
    });
    for (const slot of [withMedia, withoutMedia]) {
      expect(slot).toHaveClass('size-16');
      expect(slot).toHaveClass('min-h-tap');
      expect(slot).toHaveClass('min-w-tap');
    }
    // The slot shows the start frame when the catalog knows the exercise and
    // stays the same size (icon only) when it does not.
    expect(withMedia.querySelector('img')).not.toBeNull();
    expect(withoutMedia.querySelector('img')).toBeNull();
  });
});
