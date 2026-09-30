import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import {
  LiveEquipmentWeightEditor,
  parseDisplayWeightList,
  type LiveEquipmentOption,
} from './live-equipment-weight-editor';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const equipment: LiveEquipmentOption = {
  id: 'machine-1',
  name: 'Hack Squat',
  equipmentType: 'MACHINE',
  weightOptions: [20, 40, 60],
  exerciseLinks: [{ exerciseId: 'exercise-1' }],
};

const json = { 'Content-Type': 'application/json' };

// The editor re-reads the equipment (GET) before it saves (POST) on the same
// gym equipment endpoint.
function stubEquipmentApi({
  current = { id: equipment.id, name: equipment.name, equipmentType: equipment.equipmentType },
  readStatus = 200,
  saveStatus = 200,
}: {
  current?: { id: string; name: string; equipmentType: string };
  readStatus?: number;
  saveStatus?: number;
} = {}) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Response(JSON.stringify({ equipment: current }), { status: saveStatus, headers: json })
      : new Response(JSON.stringify({ equipment: [current] }), {
          status: readStatus,
          headers: json,
        }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderEditor(overrides: Partial<Parameters<typeof LiveEquipmentWeightEditor>[0]> = {}) {
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <LiveEquipmentWeightEditor
      open
      gymId="gym-1"
      equipment={equipment}
      unit="KG"
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      {...overrides}
    />,
  );
  const input = screen.getByLabelText('Available weights (KG)');
  const saveButton = screen.getByRole('button', { name: 'Save weights' });
  return { onSaved, onOpenChange, input, saveButton };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe('parseDisplayWeightList', () => {
  it('normalizes a discrete display-weight list', () => {
    expect(parseDisplayWeightList('20, 10; 20\n30.5 5', 'KG')).toEqual({
      ok: true,
      weightOptions: [5, 10, 20, 30.5],
    });
  });

  it('reads a comma between two digits as a decimal separator', () => {
    expect(parseDisplayWeightList('22,5 25; 27,5\n30', 'KG')).toEqual({
      ok: true,
      weightOptions: [22.5, 25, 27.5, 30],
    });
    // A comma followed by a space still separates two weights.
    expect(parseDisplayWeightList('22, 5', 'KG')).toEqual({ ok: true, weightOptions: [5, 22] });
  });

  it('names the first token it cannot read instead of dropping it', () => {
    expect(parseDisplayWeightList('20, junk, 30', 'KG')).toEqual({
      ok: false,
      problem: 'invalid',
      token: 'junk',
    });
    expect(parseDisplayWeightList('20 -5', 'KG')).toEqual({
      ok: false,
      problem: 'invalid',
      token: '-5',
    });
    // Commas glued between digits are decimals, so this is one unreadable
    // token, not the list 20, 40, 60 and not 20.4 either.
    expect(parseDisplayWeightList('20,40,60', 'KG')).toEqual({
      ok: false,
      problem: 'invalid',
      token: '20,40,60',
    });
  });

  it('applies the server bounds in kg, whatever the display unit', () => {
    expect(parseDisplayWeightList('10 0', 'KG')).toEqual({
      ok: false,
      problem: 'outOfRange',
      token: '0',
    });
    expect(parseDisplayWeightList('0,05', 'KG')).toEqual({
      ok: false,
      problem: 'outOfRange',
      token: '0,05',
    });
    expect(parseDisplayWeightList('5000 5001', 'KG')).toEqual({
      ok: false,
      problem: 'outOfRange',
      token: '5001',
    });
    // 11100 lb is about 5035 kg.
    expect(parseDisplayWeightList('45 11100', 'LB')).toEqual({
      ok: false,
      problem: 'outOfRange',
      token: '11100',
    });
    expect(parseDisplayWeightList('45', 'LB')).toEqual({ ok: true, weightOptions: [20.41] });
  });

  it('refuses an empty list and more than 200 weights', () => {
    expect(parseDisplayWeightList('  ;\n ', 'KG')).toEqual({ ok: false, problem: 'empty' });
    const many = Array.from({ length: 201 }, (_, index) => index + 1).join(' ');
    expect(parseDisplayWeightList(many, 'KG')).toEqual({ ok: false, problem: 'tooMany' });
    const limit = Array.from({ length: 200 }, (_, index) => index + 1).join(' ');
    expect(parseDisplayWeightList(limit, 'KG')).toMatchObject({ ok: true });
  });
});

describe('LiveEquipmentWeightEditor', () => {
  it('updates the selected physical equipment through the existing gym equipment API', async () => {
    const user = userEvent.setup();
    const fetchMock = stubEquipmentApi();
    const { onSaved, onOpenChange, input, saveButton } = renderEditor();

    await user.clear(input);
    await user.type(input, '40, 20, 30, 20');
    await user.click(saveButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [readUrl, readInit] = fetchMock.mock.calls[0]!;
    expect(readUrl).toBe('/api/gyms/gym-1/equipment');
    expect(readInit?.method).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/gyms/gym-1/equipment');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      equipmentId: 'machine-1',
      name: 'Hack Squat',
      equipmentType: 'MACHINE',
      weightOptions: [20, 30, 40],
    });
    expect(onSaved).toHaveBeenCalledWith({ ...equipment, weightOptions: [20, 30, 40] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('saves decimal-comma weights as decimals', async () => {
    const user = userEvent.setup();
    const fetchMock = stubEquipmentApi();
    const { onSaved, input, saveButton } = renderEditor();

    await user.clear(input);
    await user.type(input, '22,5 25 27,5');
    await user.click(saveButton);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body)).weightOptions).toEqual([
      22.5, 25, 27.5,
    ]);
  });

  it('sends the name and type the server holds now, not the page-load snapshot', async () => {
    const user = userEvent.setup();
    const fetchMock = stubEquipmentApi({
      current: { id: 'machine-1', name: 'Hack Squat (plate loaded)', equipmentType: 'OTHER' },
    });
    const { onSaved, saveButton } = renderEditor();

    await user.click(saveButton);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({
      equipmentId: 'machine-1',
      name: 'Hack Squat (plate loaded)',
      equipmentType: 'OTHER',
      weightOptions: [20, 40, 60],
    });
    expect(onSaved).toHaveBeenCalledWith({
      ...equipment,
      name: 'Hack Squat (plate loaded)',
      equipmentType: 'OTHER',
    });
  });

  it('encodes the gym id in the request path', async () => {
    const user = userEvent.setup();
    const fetchMock = stubEquipmentApi();
    const { onSaved, saveButton } = renderEditor({ gymId: 'gym/1 ?x' });

    await user.click(saveButton);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/gyms/gym%2F1%20%3Fx/equipment',
      '/api/gyms/gym%2F1%20%3Fx/equipment',
    ]);
  });

  it('blocks the save and names the token it cannot read', async () => {
    const fetchMock = stubEquipmentApi();
    const { input, saveButton } = renderEditor();

    fireEvent.change(input, { target: { value: '20 4o 60' } });
    expect(screen.getByText('“4o” is not a valid weight.')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
    expect(input).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(input, { target: { value: '20 6000' } });
    expect(
      screen.getByText('“6000” is outside the allowed range (0.1 to 5000 kg).'),
    ).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    fireEvent.click(saveButton);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '20 40 60' } });
    expect(saveButton).toBeEnabled();
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('cannot save an empty list', () => {
    const fetchMock = stubEquipmentApi();
    const { input, saveButton } = renderEditor();

    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByText('Enter at least one weight.')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'the save is refused', api: { saveStatus: 500 }, requests: 2 },
    { label: 'the equipment cannot be re-read', api: { readStatus: 500 }, requests: 1 },
    {
      label: 'the equipment no longer exists',
      api: { current: { id: 'someone-else', name: 'Other', equipmentType: 'MACHINE' } },
      requests: 1,
    },
  ])('keeps the dialog and the typed text when $label', async ({ api, requests }) => {
    const user = userEvent.setup();
    const fetchMock = stubEquipmentApi(api);
    const { onSaved, onOpenChange, input, saveButton } = renderEditor();

    await user.clear(input);
    await user.type(input, '25 50 75');
    await user.click(saveButton);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not update equipment weights.'),
    );
    expect(fetchMock).toHaveBeenCalledTimes(requests);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(input).toHaveValue('25 50 75');
    await waitFor(() => expect(saveButton).toBeEnabled());
  });
});
