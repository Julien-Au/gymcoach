import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LiveEquipmentWeightEditor,
  parseDisplayWeightList,
  type LiveEquipmentOption,
} from './live-equipment-weight-editor';

const equipment: LiveEquipmentOption = {
  id: 'machine-1',
  name: 'Hack Squat',
  equipmentType: 'MACHINE',
  weightOptions: [20, 40, 60],
  exerciseLinks: [{ exerciseId: 'exercise-1' }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LiveEquipmentWeightEditor', () => {
  it('normalizes a discrete display-weight list', () => {
    expect(parseDisplayWeightList('20, 10; 20\n30.5, junk, -5')).toEqual([10, 20, 30.5]);
  });

  it('updates the selected physical equipment through the existing gym equipment API', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ equipment: { ...equipment, weightOptions: [20, 30, 40] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <LiveEquipmentWeightEditor
        open
        gymId="gym-1"
        equipment={equipment}
        unit="KG"
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />,
    );

    const input = screen.getByLabelText('Available weights (KG)');
    await user.clear(input);
    await user.type(input, '40, 20, 30, 20');
    await user.click(screen.getByRole('button', { name: 'Save weights' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/gyms/gym-1/equipment');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      equipmentId: 'machine-1',
      name: 'Hack Squat',
      equipmentType: 'MACHINE',
      weightOptions: [20, 30, 40],
    });
    expect(onSaved).toHaveBeenCalledWith({ ...equipment, weightOptions: [20, 30, 40] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
