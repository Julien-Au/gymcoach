import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BodyweightCard } from './bodyweight-card';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

function lastFetchCall(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.at(-1) as [string, RequestInit | undefined];
}

const entries = [
  { id: 'b2', weightKg: 81.2, measuredAt: '2026-06-08T08:00:00Z' },
  { id: 'b1', weightKg: 80, measuredAt: '2026-06-01T08:00:00Z' },
];

describe('BodyweightCard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows the current bodyweight from the newest entry', () => {
    render(<BodyweightCard entries={entries} unit="KG" />);
    expect(screen.getByText(/current: 81.2 kg/i)).toBeInTheDocument();
  });

  it('shows an empty state when nothing is logged yet', () => {
    render(<BodyweightCard entries={[]} unit="KG" />);
    expect(screen.getByText(/no bodyweight logged yet/i)).toBeInTheDocument();
  });

  it('posts the quick-add weight in kg, converting from the display unit (lb)', async () => {
    const user = userEvent.setup();
    render(<BodyweightCard entries={[]} unit="LB" />);

    await user.type(screen.getByLabelText(/bodyweight \(lb\)/i), '180');
    await user.click(screen.getByRole('button', { name: 'Log' }));

    const [url, init] = lastFetchCall(fetchMock);
    expect(url).toBe('/api/bodyweight');
    const body = JSON.parse(init?.body as string) as { weightKg: number };
    // 180 lb = 81.65 kg.
    expect(body.weightKg).toBeCloseTo(81.65, 1);
    expect(refresh).toHaveBeenCalled();
  });

  it('rejects an empty or non-positive weight without calling the API', async () => {
    const user = userEvent.setup();
    render(<BodyweightCard entries={[]} unit="KG" />);

    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes an entry through the API', async () => {
    const user = userEvent.setup();
    render(<BodyweightCard entries={entries} unit="KG" />);

    await user.click(screen.getAllByRole('button', { name: /delete entry/i })[0] as HTMLElement);

    const [url, init] = lastFetchCall(fetchMock);
    expect(url).toBe('/api/bodyweight/b2');
    expect(init?.method).toBe('DELETE');
    expect(refresh).toHaveBeenCalled();
  });

  it('lists entries in the display unit', () => {
    render(<BodyweightCard entries={entries} unit="LB" />);
    // 80 kg = 176.4 lb.
    expect(screen.getByText(/176.4 lb/)).toBeInTheDocument();
  });

  describe('bodyweight goal (issue #398)', () => {
    it('shows the goal and colours the delta by the direction of the goal', () => {
      // The window went 80 -> 81.2 kg: good toward a higher goal...
      const { unmount } = render(<BodyweightCard entries={entries} unit="KG" goalKg={84} />);
      expect(screen.getByText(/goal: 84 kg/i)).toBeInTheDocument();
      const delta = screen.getByTestId('bodyweight-goal-delta');
      expect(delta).toHaveTextContent('2.8 kg to go');
      expect(delta).toHaveAttribute('data-tone', 'good');
      unmount();

      // ...and bad toward a lower one.
      render(<BodyweightCard entries={entries} unit="KG" goalKg={76} />);
      expect(screen.getByTestId('bodyweight-goal-delta')).toHaveAttribute('data-tone', 'bad');
    });

    it('says when the goal is reached', () => {
      render(<BodyweightCard entries={entries} unit="KG" goalKg={81} />);
      expect(screen.getByTestId('bodyweight-goal-delta')).toHaveTextContent('Goal reached');
    });

    it('saves the goal in kg, converting from the display unit (lb)', async () => {
      const user = userEvent.setup();
      render(<BodyweightCard entries={entries} unit="LB" />);

      await user.type(screen.getByLabelText(/goal \(lb\)/i), '165');
      await user.click(screen.getByRole('button', { name: 'Set goal' }));

      const [url, init] = lastFetchCall(fetchMock);
      expect(url).toBe('/api/profile');
      expect(init?.method).toBe('PATCH');
      const body = JSON.parse(init?.body as string) as { bodyweightGoalKg: number };
      // 165 lb = 74.84 kg.
      expect(body.bodyweightGoalKg).toBeCloseTo(74.84, 1);
      expect(refresh).toHaveBeenCalled();
    });

    it('rejects a goal outside the bounds without calling the API', async () => {
      const user = userEvent.setup();
      render(<BodyweightCard entries={entries} unit="KG" />);

      await user.type(screen.getByLabelText(/goal \(kg\)/i), '5');
      await user.click(screen.getByRole('button', { name: 'Set goal' }));
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('removes the goal with a null write', async () => {
      const user = userEvent.setup();
      render(<BodyweightCard entries={entries} unit="KG" goalKg={76} />);

      await user.click(screen.getByRole('button', { name: 'Remove goal' }));
      const [url, init] = lastFetchCall(fetchMock);
      expect(url).toBe('/api/profile');
      expect(JSON.parse(init?.body as string)).toEqual({ bodyweightGoalKg: null });
    });

    it('shows no goal line or delta without a goal', () => {
      render(<BodyweightCard entries={entries} unit="KG" />);
      expect(screen.queryByTestId('bodyweight-goal-delta')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove goal' })).toBeNull();
    });
  });
});
