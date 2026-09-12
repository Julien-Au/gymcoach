import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryCalendar, type HistoryCalendarSession } from './history-calendar';

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: '/history',
  query: 'month=2026-09',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

const sessions: HistoryCalendarSession[] = [
  {
    id: 'session-1',
    startedAt: '2026-09-12T10:30:00.000Z',
    title: 'Upper body',
    programName: 'Strength',
    workingSets: 4,
    volumeLabel: '2,400 kg vol.',
    durationLabel: '45 min',
    cardioDistanceLabel: null,
    cardioDurationLabel: null,
    cardioHeartRateLabel: null,
  },
  {
    id: 'session-2',
    startedAt: '2026-09-12T16:00:00.000Z',
    title: 'Evening session',
    programName: null,
    workingSets: 3,
    volumeLabel: '1,500 kg vol.',
    durationLabel: '30 min',
    cardioDistanceLabel: null,
    cardioDurationLabel: null,
    cardioHeartRateLabel: null,
  },
];

describe('HistoryCalendar', () => {
  beforeEach(() => {
    navigation.push.mockReset();
    navigation.query = 'month=2026-09';
    window.history.replaceState({}, '', '/history?month=2026-09');
  });

  it('marks workout days and lists sessions for the selected date', () => {
    render(
      <HistoryCalendar monthKey="2026-09" initialDay="2026-09-12" sessions={sessions} />,
    );

    const day = screen.getByRole('gridcell', { name: /12.*2 workouts/i });
    expect(day).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Upper body')).toBeInTheDocument();
    expect(screen.getByText('Evening session')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Upper body/i })).toHaveAttribute(
      'href',
      '/history/session-1?month=2026-09&day=2026-09-12',
    );
  });

  it('updates the selected day in place without navigating away', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    render(
      <HistoryCalendar monthKey="2026-09" initialDay="2026-09-12" sessions={sessions} />,
    );

    fireEvent.click(screen.getByRole('gridcell', { name: /13/ }));

    expect(screen.getByText('No completed workouts on this date.')).toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/history?month=2026-09&day=2026-09-13');
    replaceState.mockRestore();
  });

  it('navigates between months while preserving other query filters', () => {
    navigation.query = 'programId=program-1&month=2026-09';
    render(
      <HistoryCalendar
        monthKey="2026-09"
        initialDay="2026-09-12"
        sessions={sessions}
        selectedProgramId="program-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(navigation.push).toHaveBeenCalledTimes(1);
    const href = navigation.push.mock.calls[0]?.[0] as string;
    expect(href).toContain('/history?');
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('month')).toBe('2026-10');
    expect(params.get('programId')).toBe('program-1');
    expect(params.has('day')).toBe(false);
  });
});
