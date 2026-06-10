import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeloadBanner } from './deload-banner';

describe('DeloadBanner', () => {
  it('renders nothing without reasons', () => {
    const { container } = render(<DeloadBanner reasons={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the stalled lifts by name', () => {
    render(
      <DeloadBanner
        reasons={[
          { kind: 'stalled-lifts', exerciseNames: ['Bench press', 'Squat'] },
        ]}
      />,
    );
    expect(screen.getByText('A deload week looks due')).toBeInTheDocument();
    expect(
      screen.getByText('2 lifts have stalled: Bench press, Squat.'),
    ).toBeInTheDocument();
  });

  it('explains a chronically low readiness average', () => {
    render(
      <DeloadBanner
        reasons={[
          { kind: 'low-readiness', averageReadiness: 1.7, checkins: 5 },
        ]}
      />,
    );
    expect(
      screen.getByText(
        'Your readiness has averaged 1.7/5 over your last 5 check-ins.',
      ),
    ).toBeInTheDocument();
  });

  it('shows one line per reason when both triggers hold', () => {
    render(
      <DeloadBanner
        reasons={[
          { kind: 'stalled-lifts', exerciseNames: ['Squat', 'Deadlift'] },
          { kind: 'low-readiness', averageReadiness: 2, checkins: 4 },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
