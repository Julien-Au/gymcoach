import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingSet } from '@/lib/indexeddb';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import { SessionRunner } from './session-runner';

// The runner is wired to IndexedDB, the sync queue and the router. These tests
// cover the wiring around the in-session exercise menu and the superset
// transition, so the storage layer and the leaf components are stubbed and the
// runner's own state machine runs for real.

type MenuProps = {
  loggedSetCount: number;
  onChanged: (options?: {
    selectProgramExerciseId?: string;
    removedProgramExerciseId?: string;
  }) => void;
};
type TableProps = {
  programExercise: { id: string };
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
};

const harness = vi.hoisted(() => ({
  liveSets: [] as unknown[],
  menu: null as unknown,
  table: null as unknown,
  tableUnmounts: 0,
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: harness.refresh, replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => harness.liveSets }));
vi.mock('@/lib/indexeddb', () => ({ generateLocalId: () => 'local-1', getDB: vi.fn() }));
vi.mock('@/lib/sync', () => ({
  bindAutoSync: () => () => undefined,
  drainDroppedEquipment: async () => [],
  flushPendingSets: vi.fn(),
  onEquipmentDropped: () => () => undefined,
  pendingSetUpdateState: vi.fn(),
  queueSet: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/sync-hydration', () => ({ hydrateFromServerSets: async () => undefined }));
vi.mock('@/lib/wake-lock', () => ({
  acquireWakeLock: async () => undefined,
  bindWakeLockToVisibility: () => () => undefined,
  releaseWakeLock: async () => undefined,
}));
vi.mock('@/lib/vibrate', () => ({
  vibrate: () => undefined,
  VIBRATION_PATTERNS: { validate: [], restEnd: [] },
}));
vi.mock('@/components/shared/use-exercise-name', () => ({
  useExerciseName: () => (name: string) => name,
}));
vi.mock('@/components/shared/use-training-name', () => ({
  useTrainingName: () => (name: string) => name,
}));
vi.mock('@/components/session/exercise-card', () => ({ ExerciseCard: () => null }));
vi.mock('@/components/session/sets-list', () => ({ SetsList: () => null }));
vi.mock('@/components/session/set-input', () => ({ SetInput: () => null }));
vi.mock('@/components/session/session-summary', () => ({ SessionSummary: () => null }));
vi.mock('@/components/session/return-to-training-notice', () => ({
  ReturnToTrainingNotice: () => null,
}));
vi.mock('@/components/session/session-exercise-strip', () => ({
  SessionExerciseStrip: () => null,
}));
vi.mock('@/components/session/session-exercise-menu', () => ({
  SessionExerciseMenu: (props: MenuProps) => {
    harness.menu = props;
    return null;
  },
}));
vi.mock('@/components/session/editable-sets-table', () => ({
  EditableSetsTable: function TableStub(props: TableProps) {
    harness.table = props;
    useEffect(
      () => () => {
        harness.tableUnmounts += 1;
      },
      [],
    );
    return <div data-testid="sets-table">{props.programExercise.id}</div>;
  },
}));
vi.mock('@/components/session/rest-timer', () => ({
  RestTimer: ({ onSkip }: { onSkip: () => void }) => (
    <button type="button" onClick={onSkip}>
      skip rest
    </button>
  ),
}));

const menu = () => harness.menu as MenuProps;
const table = () => harness.table as TableProps;

function exercise(id: string, name: string): Exercise {
  return {
    id,
    userId: 'u',
    name,
    muscleGroup: 'CHEST',
    category: 'COMPOUND',
    defaultRestSec: 120,
    notes: null,
    usesBodyweight: false,
    equipmentType: 'BARBELL',
    createdAt: new Date(),
  };
}

function row(
  id: string,
  order: number,
  supersetGroup: number | null = null,
): ProgramExercise & { exercise: Exercise } {
  return {
    id: 'pe-' + id,
    workoutId: 'w',
    exerciseId: id,
    order,
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 10,
    targetRIR: 2,
    restSec: 120,
    tempo: null,
    notes: null,
    supersetGroup,
    autoregulationMode: 'PRESERVE_RIR',
    fatigueRate: null,
    loadAdjustmentPct: null,
    exercise: exercise(id, id),
  };
}

type RunnerProps = ComponentProps<typeof SessionRunner>;

function runner(rows: Array<ProgramExercise & { exercise: Exercise }>, initial?: string) {
  const session = {
    id: 's1',
    workout: { id: 'w', name: 'Push', program: null, exercises: rows },
    sets: [],
    gym: null,
  } as unknown as RunnerProps['session'];
  return (
    <SessionRunner
      session={session}
      lastPerformances={{}}
      returnRecommendations={{}}
      readiness={null}
      deloadActive={false}
      unit="KG"
      initialProgramExerciseId={initial}
      catalog={[]}
    />
  );
}

// Lets the mount effect (IndexedDB hydration) settle inside act.
async function renderRunner(element: ReactElement) {
  const view = render(element);
  await act(async () => undefined);
  return view;
}

const loggedSet = { weight: 60, reps: 8, rir: 2, durationSec: null, distanceM: null };

beforeEach(() => {
  harness.liveSets = [];
  harness.menu = null;
  harness.table = null;
  harness.tableUnmounts = 0;
  harness.refresh.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SessionRunner exercise menu wiring', () => {
  it('counts every logged set of the exercise for the menu warning, warm-ups included', async () => {
    harness.liveSets = [
      { localId: 'l1', exerciseId: 'bench', setNumber: 1, isWarmup: true, isDropSet: false },
    ] as unknown as PendingSet[];
    await renderRunner(runner([row('bench', 1), row('fly', 2)]));
    expect(menu().loggedSetCount).toBe(1);
  });

  it('selects the neighbour after a removal, keeps the URL in step and keeps the sets table mounted', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const view = await renderRunner(runner([row('bench', 1), row('fly', 2)], 'pe-fly'));
    expect(screen.getByTestId('sets-table')).toHaveTextContent('pe-fly');

    act(() => {
      menu().onChanged({ selectProgramExerciseId: 'pe-bench', removedProgramExerciseId: 'pe-fly' });
    });
    expect(harness.refresh).toHaveBeenCalledOnce();
    // Until the refreshed props arrive the removed row is still the current one.
    expect(screen.getByTestId('sets-table')).toHaveTextContent('pe-fly');

    view.rerender(runner([row('bench', 1)], 'pe-fly'));

    expect(screen.getByTestId('sets-table')).toHaveTextContent('pe-bench');
    expect(screen.queryByText('No exercises in this session.')).not.toBeInTheDocument();
    // The list was one row shorter for a render; the table (and the drafts it
    // parks) must not have been torn down for it.
    expect(harness.tableUnmounts).toBe(0);
    expect(replaceState).toHaveBeenLastCalledWith(
      window.history.state,
      '',
      '/session/s1?programExerciseId=pe-bench',
    );
  });
});

describe('SessionRunner superset transition', () => {
  it('navigates to the next member once: skipping the transition rest does not navigate again', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    await renderRunner(runner([row('a1', 1, 1), row('a2', 2, 1), row('a3', 3, 1)]));
    expect(screen.getByTestId('sets-table')).toHaveTextContent('pe-a1');

    await act(async () => {
      await table().onSubmit({ ...loggedSet, isWarmup: false, isDropSet: false, notes: null });
    });

    // The next member is shown right away, while the transition rest runs.
    expect(screen.getByTestId('sets-table')).toHaveTextContent('pe-a2');
    expect(replaceState).toHaveBeenCalledTimes(1);

    fireEvent.click(await screen.findByRole('button', { name: 'skip rest' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'skip rest' })).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('sets-table')).toHaveTextContent('pe-a2');
    expect(replaceState).toHaveBeenCalledTimes(1);
  });
});
