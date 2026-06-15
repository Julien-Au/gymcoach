import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Exercise, ProgramExercise } from '@prisma/client';
import { SetInput } from './set-input';

const exo: Exercise = {
  id: 'e1',
  userId: 'u',
  name: 'Squat',
  muscleGroup: 'QUADS',
  category: 'COMPOUND',
  defaultRestSec: 120,
  notes: null,
  usesBodyweight: false,
  createdAt: new Date(),
};

const pe: ProgramExercise & { exercise: Exercise } = {
  id: 'pe',
  workoutId: 'w',
  exerciseId: 'e1',
  order: 1,
  targetSets: 3,
  targetRepsMin: 6,
  targetRepsMax: 10,
  targetRIR: 2,
  restSec: 120,
  tempo: null,
  notes: null,
  supersetGroup: null,
  exercise: exo,
};

function renderSetInput(unit: 'KG' | 'LB' = 'KG') {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <SetInput
      programExercise={pe}
      existingSets={[]}
      lastPerformance={undefined}
      readiness={null}
      deloadActive={false}
      unit={unit}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit };
}

describe('SetInput quick entry', () => {
  it('fills weight, reps, and RIR from a valid shorthand', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSetInput('KG');

    await user.type(screen.getByLabelText('Quick entry'), '100x8@9');
    await user.click(screen.getByRole('button', { name: /log the set/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ weight: 100, reps: 8, rir: 1 }),
    );
  });

  it('keeps the RIR untouched when the shorthand has no RPE', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSetInput('KG');

    await user.type(screen.getByLabelText('Quick entry'), '62.5x8');
    await user.click(screen.getByRole('button', { name: /log the set/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      // targetRIR (2) comes from the default pre-fill and must survive.
      expect.objectContaining({ weight: 62.5, reps: 8, rir: 2 }),
    );
  });

  it('converts the shorthand weight from the display unit (lb) to kg', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSetInput('LB');

    await user.type(screen.getByLabelText('Quick entry'), '225x5');
    await user.click(screen.getByRole('button', { name: /log the set/i }));

    const submitted = onSubmit.mock.calls[0]?.[0] as { weight: number };
    // 225 lb = 102.06 kg.
    expect(submitted.weight).toBeCloseTo(102.06, 1);
  });

  it('shows an inline format hint on invalid non-empty input', async () => {
    const user = userEvent.setup();
    renderSetInput('KG');

    expect(screen.queryByText(/expected format/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Quick entry'), 'squat');
    expect(screen.getByText(/expected format/i)).toBeInTheDocument();
  });

  it('does not touch the form values on an invalid entry', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSetInput('KG');

    await user.type(screen.getByLabelText('Quick entry'), 'nonsense');
    await user.click(screen.getByRole('button', { name: /log the set/i }));

    // Defaults still submit: mid rep range (8), target RIR (2), weight 0.
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ weight: 0, reps: 8, rir: 2 }),
    );
  });
});

// Cardio mode (issue #133): the logger swaps weight/reps for duration and
// optional distance and submits the normalized cardio payload.
const cardioExo: Exercise = {
  ...exo,
  id: 'e2',
  name: 'Running',
  muscleGroup: 'OTHER',
  category: 'CARDIO',
};

const cardioPE: ProgramExercise & { exercise: Exercise } = {
  ...pe,
  id: 'pe2',
  exerciseId: 'e2',
  targetSets: 1,
  exercise: cardioExo,
};

function renderCardioInput() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <SetInput
      programExercise={cardioPE}
      existingSets={[]}
      lastPerformance={undefined}
      readiness={null}
      deloadActive={false}
      unit="KG"
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit };
}

describe('SetInput cardio mode', () => {
  it('shows duration/distance inputs instead of load/reps', () => {
    renderCardioInput();
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/distance/i)).toBeInTheDocument();
    expect(screen.queryByText(/load \(/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Quick entry')).not.toBeInTheDocument();
    expect(screen.queryByText(/reps in reserve/i)).not.toBeInTheDocument();
  });

  it('submits duration in seconds and distance in meters with weight 0 / reps 1', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCardioInput();

    await user.type(screen.getByLabelText(/duration/i), '12:30');
    await user.type(screen.getByLabelText(/distance/i), '2.5');
    await user.click(screen.getByRole('button', { name: /log the set/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        weight: 0,
        reps: 1,
        rir: null,
        durationSec: 750,
        distanceM: 2500,
        isWarmup: false,
        isDropSet: false,
      }),
    );
  });

  it('keeps the log button disabled until the duration is valid', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCardioInput();

    const button = screen.getByRole('button', { name: /log the set/i });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/duration/i), '12:30');
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ durationSec: 750, distanceM: null }),
    );
  });

  it('strength submissions carry null cardio fields (pinned)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSetInput('KG');

    await user.type(screen.getByLabelText('Quick entry'), '100x8');
    await user.click(screen.getByRole('button', { name: /log the set/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ weight: 100, reps: 8, durationSec: null, distanceM: null }),
    );
  });
});

// Opt-in AI free-text parse (issue #210): a deliberate action that fills the
// form from a validated parse, never auto-logs, and degrades gracefully when
// the (untrusted) model output cannot be used.
describe('SetInput AI parse', () => {
  function stubFetch(parsed: unknown, ok = true) {
    const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => ({ parsed }) });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('fills weight, reps and RIR from a strength parse, then logs on confirm', async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({ kind: 'strength', weight: 100, reps: 8, rir: 2 });
    const { onSubmit } = renderSetInput('KG');

    await user.type(screen.getByLabelText(/describe the set/i), '100 for 8, 2 left');
    await user.click(screen.getByRole('button', { name: /parse with ai/i }));

    // The request targets the parse route with the exercise id and text.
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/sets/parse');
    expect(JSON.parse(init.body as string)).toEqual({
      exerciseId: 'e1',
      text: '100 for 8, 2 left',
    });

    // Nothing logged yet - the user must confirm.
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /log the set/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ weight: 100, reps: 8, rir: 2 }),
    );
  });

  it('converts the parsed display-unit weight to kg (lb user)', async () => {
    const user = userEvent.setup();
    stubFetch({ kind: 'strength', weight: 225, reps: 5 });
    const { onSubmit } = renderSetInput('LB');

    await user.type(screen.getByLabelText(/describe the set/i), '225 for 5');
    await user.click(screen.getByRole('button', { name: /parse with ai/i }));
    await user.click(screen.getByRole('button', { name: /log the set/i }));

    const submitted = onSubmit.mock.calls[0]?.[0] as { weight: number };
    expect(submitted.weight).toBeCloseTo(102.06, 1); // 225 lb
  });

  it('fills nothing and shows a hint on a null parse (never logs garbage)', async () => {
    const user = userEvent.setup();
    stubFetch(null);
    const { onSubmit } = renderSetInput('KG');

    await user.type(screen.getByLabelText(/describe the set/i), 'how do I squat?');
    await user.click(screen.getByRole('button', { name: /parse with ai/i }));

    expect(screen.getByText(/could not parse that/i)).toBeInTheDocument();

    // The defaults survive untouched: nothing was filled from the bad parse.
    await user.click(screen.getByRole('button', { name: /log the set/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ weight: 0, reps: 8, rir: 2 }),
    );
  });

  it('ignores a cardio parse on a strength exercise (wrong shape)', async () => {
    const user = userEvent.setup();
    stubFetch({ kind: 'cardio', durationSec: 1500 });
    const { onSubmit } = renderSetInput('KG');

    await user.type(screen.getByLabelText(/describe the set/i), 'ran 5k');
    await user.click(screen.getByRole('button', { name: /parse with ai/i }));

    expect(screen.getByText(/could not parse that/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /log the set/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ weight: 0, reps: 8 }),
    );
  });
});
