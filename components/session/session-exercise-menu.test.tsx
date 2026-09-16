import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import { SessionExerciseMenu } from './session-exercise-menu';

vi.mock('@/components/shared/use-exercise-name', () => ({
  useExerciseName: () => (name: string) => name,
}));

const bench = {
  id: 'bench',
  name: 'Bench Press',
  muscleGroup: 'CHEST',
  category: 'COMPOUND',
  equipmentType: 'BARBELL',
  defaultRestSec: 120,
} as Exercise;
const incline = {
  ...bench,
  id: 'incline',
  name: 'Incline Press',
  equipmentType: 'DUMBBELL',
} as Exercise;
const row = {
  ...bench,
  id: 'row',
  name: 'Cable Row',
  muscleGroup: 'BACK_THICKNESS',
  equipmentType: 'CABLE',
  defaultRestSec: 90,
} as Exercise;
const decline = {
  ...bench,
  id: 'decline',
  name: 'Decline Press',
} as Exercise;

const programExercise = {
  id: 'pe-bench',
  workoutId: 'workout-1',
  exerciseId: 'bench',
  order: 1,
  targetSets: 4,
  targetRepsMin: 8,
  targetRepsMax: 10,
  targetRIR: 2,
  restSec: 120,
  autoregulationMode: 'PRESERVE_RIR',
  fatigueRate: null,
  loadAdjustmentPct: null,
  tempo: null,
  notes: null,
  supersetGroup: null,
  exercise: bench,
} as ProgramExercise & { exercise: Exercise };
const nextProgramExercise = {
  ...programExercise,
  id: 'pe-row',
  exerciseId: 'row',
  order: 2,
  exercise: row,
} as ProgramExercise & { exercise: Exercise };

function renderMenu(loggedSetCount = 0, onChanged = vi.fn()) {
  return render(
    <SessionExerciseMenu
      open
      onOpenChange={vi.fn()}
      programExercise={programExercise}
      programExercises={[programExercise, nextProgramExercise]}
      catalog={[bench, incline, row]}
      loggedSetCount={loggedSetCount}
      onChanged={onChanged}
    />,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
});

describe('SessionExerciseMenu', () => {
  it('offers replacements only from the current primary muscle group', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Replace exercise' }));
    expect(screen.getByRole('button', { name: 'Incline Press' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cable Row' })).not.toBeInTheDocument();
  });

  it('does not offer a replacement already assigned elsewhere in the workout', () => {
    const declineProgramExercise = {
      ...programExercise,
      id: 'pe-decline',
      exerciseId: 'decline',
      order: 2,
      exercise: decline,
    } as ProgramExercise & { exercise: Exercise };
    render(
      <SessionExerciseMenu
        open
        onOpenChange={vi.fn()}
        programExercise={programExercise}
        programExercises={[programExercise, declineProgramExercise, nextProgramExercise]}
        catalog={[bench, incline, decline, row]}
        loggedSetCount={0}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Replace exercise' }));
    expect(screen.getByRole('button', { name: 'Incline Press' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline Press' })).not.toBeInTheDocument();
  });

  it('replaces through the existing owned program-exercise route', async () => {
    const onChanged = vi.fn();
    renderMenu(0, onChanged);
    fireEvent.click(screen.getByRole('button', { name: 'Replace exercise' }));
    fireEvent.click(screen.getByRole('button', { name: 'Incline Press' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/program-exercises/pe-bench');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      exerciseId: 'incline',
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 10,
    });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('requires confirmation when replacement would leave logged sets on the original exercise', async () => {
    renderMenu(2);
    fireEvent.click(screen.getByRole('button', { name: 'Replace exercise' }));
    fireEvent.click(screen.getByRole('button', { name: 'Incline Press' }));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/already logged/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /replace with incline press/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  });

  it('adds only exercises that are not already in the workout', async () => {
    const onChanged = vi.fn();
    renderMenu(0, onChanged);
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    expect(screen.queryByRole('button', { name: 'Cable Row' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Incline Press' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/workouts/workout-1/program-exercises');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      exerciseId: 'incline',
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetRIR: 2,
      restSec: 120,
    });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('requires removal confirmation and selects the neighboring exercise after delete', async () => {
    const onChanged = vi.fn();
    renderMenu(2, onChanged);
    fireEvent.click(screen.getByRole('button', { name: 'Remove exercise' }));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/remain in history/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove exercise' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/program-exercises/pe-bench');
    expect(init?.method).toBe('DELETE');
    expect(onChanged).toHaveBeenCalledWith({
      selectProgramExerciseId: 'pe-row',
      removedProgramExerciseId: 'pe-bench',
    });
  });
});
