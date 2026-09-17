import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SetValuePicker } from './set-value-picker';

describe('SetValuePicker', () => {
  it('keeps a tapped gym weight pending until Apply confirms it', () => {
    const onChoose = vi.fn();
    render(
      <SetValuePicker
        open
        kind="weight"
        value={60}
        options={[{ value: 50 }, { value: 60 }, { value: 70 }]}
        unit="KG"
        onClose={vi.fn()}
        onChoose={onChoose}
      />,
    );

    const option = screen.getByRole('button', { name: '70 kg' });
    fireEvent.click(option);

    expect(onChoose).not.toHaveBeenCalled();
    expect(option).toHaveAttribute('data-picker-selected', 'true');
    expect(screen.getByRole('spinbutton')).toHaveValue(70);

    fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith(70);
  });

  it('tracks the option under the fixed pointer while scrolling without auto-confirming', () => {
    const onChoose = vi.fn();
    render(
      <SetValuePicker
        open
        kind="weight"
        value={60}
        options={[{ value: 50 }, { value: 60 }, { value: 70 }]}
        unit="KG"
        onClose={vi.fn()}
        onChoose={onChoose}
      />,
    );

    const list = screen.getByTestId('set-value-options');
    const fifty = screen.getByRole('button', { name: '50 kg' });
    const sixty = screen.getByRole('button', { name: '60 kg' });
    const seventy = screen.getByRole('button', { name: '70 kg' });

    expect(screen.getByTestId('weight-picker-pointer')).toBeInTheDocument();
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 300 });
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 300 } as DOMRect);
    vi.spyOn(fifty, 'getBoundingClientRect').mockReturnValue({ top: -48, height: 64 } as DOMRect);
    vi.spyOn(sixty, 'getBoundingClientRect').mockReturnValue({ top: 34, height: 64 } as DOMRect);
    vi.spyOn(seventy, 'getBoundingClientRect').mockReturnValue({ top: 118, height: 64 } as DOMRect);

    fireEvent.scroll(list);

    expect(onChoose).not.toHaveBeenCalled();
    expect(seventy).toHaveAttribute('data-picker-selected', 'true');
    expect(screen.getByRole('spinbutton')).toHaveValue(70);

    fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));
    expect(onChoose).toHaveBeenCalledWith(70);
  });

  it('updates the barbell loading preview while a gym weight is still pending', () => {
    const onChoose = vi.fn();
    render(
      <SetValuePicker
        open
        kind="weight"
        value={60}
        options={[{ value: 60 }, { value: 70 }]}
        unit="KG"
        loadConstraints={{
          equipmentType: 'BARBELL',
          barWeights: [20],
          plateWeights: [20, 10, 5, 2.5],
          weightOptions: [60, 70],
        }}
        onClose={vi.fn()}
        onChoose={onChoose}
      />,
    );

    const preview = screen.getByTestId('barbell-side-diagram');
    expect(preview).toHaveAttribute('data-target-weight', '60');

    fireEvent.click(screen.getByRole('button', { name: '70 kg' }));

    expect(onChoose).not.toHaveBeenCalled();
    expect(preview).toHaveAttribute('data-target-weight', '70');
  });

  it('prefers the closest bar when the target is below every available bar', () => {
    render(
      <SetValuePicker
        open
        kind="weight"
        value={10}
        options={[{ value: 10 }]}
        unit="KG"
        loadConstraints={{
          equipmentType: 'BARBELL',
          barWeights: [20, 30],
          plateWeights: [5],
          weightOptions: [10],
        }}
        onClose={vi.fn()}
        onChoose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('barbell-side-diagram')).toHaveTextContent('20 kg');
    expect(screen.getByTestId('barbell-side-diagram')).not.toHaveTextContent('30 kg');
  });

  it('retains manual decimal entry as a weight fallback', () => {
    const onChoose = vi.fn();
    render(
      <SetValuePicker
        open
        kind="weight"
        value={60}
        options={[{ value: 50 }, { value: 60 }, { value: 70 }]}
        unit="KG"
        onClose={vi.fn()}
        onChoose={onChoose}
      />,
    );

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '72.5' } });
    fireEvent.scroll(screen.getByTestId('set-value-options'));
    expect(screen.getByRole('spinbutton')).toHaveValue(72.5);
    fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));

    expect(onChoose).toHaveBeenCalledWith(72.5);
  });

  it('keeps repetition choices pending until Apply too', () => {
    const onChoose = vi.fn();
    render(
      <SetValuePicker
        open
        kind="reps"
        value={10}
        options={[{ value: 8 }, { value: 10 }, { value: 12 }]}
        unit="KG"
        onClose={vi.fn()}
        onChoose={onChoose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '12 reps' }));
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.getByRole('spinbutton')).toHaveValue(12);

    fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));
    expect(onChoose).toHaveBeenCalledWith(12);
  });
});
