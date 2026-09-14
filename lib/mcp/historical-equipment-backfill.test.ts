import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    set: { findMany: vi.fn() },
    gymEquipment: { findMany: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import { previewHistoricalEquipmentBackfill } from '@/lib/mcp/historical-equipment-backfill';

const findSets = vi.mocked(db.set.findMany);
const findEquipment = vi.mocked(db.gymEquipment.findMany);

describe('historical equipment backfill preview', () => {
  beforeEach(() => {
    findSets.mockReset();
    findEquipment.mockReset();
  });

  it('groups missing assignments and exposes only evidence-based suggestions', async () => {
    findSets
      .mockResolvedValueOnce([
        {
          id: 'set-1',
          setNumber: 1,
          weight: 100,
          reps: 8,
          completedAt: new Date('2026-08-20T10:00:00.000Z'),
          exercise: { id: 'exercise-rdl', name: 'Romanian Deadlift', equipmentType: 'BARBELL' },
          session: {
            id: 'session-1',
            gymId: 'gym-xfit',
            startedAt: new Date('2026-08-20T09:30:00.000Z'),
            gym: { id: 'gym-xfit', name: 'X-Fit' },
          },
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    findEquipment.mockResolvedValue([
      {
        id: 'bar-20',
        gymId: 'gym-xfit',
        name: '20 kg barbell',
        equipmentType: 'BARBELL',
        exerciseLinks: [{ exerciseId: 'exercise-rdl' }],
      },
    ] as never);

    const result = await previewHistoricalEquipmentBackfill('user-1', {});

    expect(result.groups[0]).toMatchObject({
      gym: { id: 'gym-xfit', name: 'X-Fit' },
      missingSetIds: ['set-1'],
      suggestedEquipment: {
        equipmentId: 'bar-20',
        reason: 'ONLY_LINKED_EQUIPMENT',
      },
      suggestionIsConfirmation: false,
    });
    expect(result.guidance).toContain('not authorization');
  });

  it('prefers the most-used linked equipment when multiple candidates have history', async () => {
    findSets
      .mockResolvedValueOnce([
        {
          id: 'set-gap',
          setNumber: 1,
          weight: 80,
          reps: 10,
          completedAt: new Date('2026-08-21T10:00:00.000Z'),
          exercise: { id: 'exercise-row', name: 'Cable Row', equipmentType: 'CABLE' },
          session: {
            id: 'session-gap',
            gymId: 'gym-xfit',
            startedAt: new Date('2026-08-21T09:30:00.000Z'),
            gym: { id: 'gym-xfit', name: 'X-Fit' },
          },
        },
      ] as never)
      .mockResolvedValueOnce([
        { exerciseId: 'exercise-row', gymEquipmentId: 'cable-b', session: { gymId: 'gym-xfit' } },
        { exerciseId: 'exercise-row', gymEquipmentId: 'cable-b', session: { gymId: 'gym-xfit' } },
        { exerciseId: 'exercise-row', gymEquipmentId: 'cable-a', session: { gymId: 'gym-xfit' } },
      ] as never);
    findEquipment.mockResolvedValue([
      {
        id: 'cable-a',
        gymId: 'gym-xfit',
        name: 'Cable A',
        equipmentType: 'CABLE',
        exerciseLinks: [{ exerciseId: 'exercise-row' }],
      },
      {
        id: 'cable-b',
        gymId: 'gym-xfit',
        name: 'Cable B',
        equipmentType: 'CABLE',
        exerciseLinks: [{ exerciseId: 'exercise-row' }],
      },
    ] as never);

    const result = await previewHistoricalEquipmentBackfill('user-1', {});

    expect(result.groups[0]?.suggestedEquipment).toMatchObject({
      equipmentId: 'cable-b',
      assignedHistoricalSetCount: 2,
      reason: 'MOST_USED_ASSIGNED_HISTORY',
    });
    expect(result.groups[0]?.suggestionIsConfirmation).toBe(false);
  });
});
