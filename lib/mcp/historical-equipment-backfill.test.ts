import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn(),
    set: { findMany: vi.fn() },
    gymEquipment: { findMany: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import {
  applyHistoricalEquipmentBackfill,
  previewHistoricalEquipmentBackfill,
  undoHistoricalEquipmentBackfill,
} from '@/lib/mcp/historical-equipment-backfill';

const transaction = vi.mocked(db.$transaction);
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

describe('historical equipment backfill apply', () => {
  beforeEach(() => {
    transaction.mockReset();
  });

  it('requires explicit confirmation before opening a transaction', async () => {
    await expect(
      applyHistoricalEquipmentBackfill('user-1', {
        gymId: 'gym-xfit',
        exerciseId: 'exercise-row',
        equipmentId: 'cable-a',
        setIds: ['set-1'],
        confirmed: false,
      }),
    ).rejects.toThrow('explicit confirmation');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('atomically assigns only exact still-unassigned sets and creates a durable audit record', async () => {
    const tx = {
      gymEquipment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'cable-a',
          gymId: 'gym-xfit',
          name: 'Cable A',
          equipmentType: 'CABLE',
          manufacturer: 'Acme',
          modelName: 'Stack 1',
          weightOptions: [20, 30, 40],
        }),
      },
      set: {
        findMany: vi.fn().mockResolvedValue([{ id: 'set-1' }, { id: 'set-2' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      mcpHistoricalEquipmentBackfillAudit: {
        create: vi.fn().mockResolvedValue({
          id: 'audit-1',
          createdAt: new Date('2026-09-15T00:00:00.000Z'),
        }),
      },
    };
    transaction.mockImplementation((async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx)) as never);

    const result = await applyHistoricalEquipmentBackfill('user-1', {
      gymId: 'gym-xfit',
      exerciseId: 'exercise-row',
      equipmentId: 'cable-a',
      setIds: ['set-1', 'set-2'],
      confirmed: true,
    });

    expect(tx.set.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['set-1', 'set-2'] },
          exerciseId: 'exercise-row',
          gymEquipmentId: null,
          session: { userId: 'user-1', gymId: 'gym-xfit' },
        }),
        data: expect.objectContaining({
          gymEquipmentId: 'cable-a',
          equipmentNameSnapshot: 'Cable A',
        }),
      }),
    );
    expect(tx.mcpHistoricalEquipmentBackfillAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          gymId: 'gym-xfit',
          exerciseId: 'exercise-row',
          equipmentId: 'cable-a',
          setIds: ['set-1', 'set-2'],
        }),
      }),
    );
    expect(result).toMatchObject({ auditId: 'audit-1', appliedSetCount: 2 });
  });
});

describe('historical equipment backfill undo', () => {
  beforeEach(() => {
    transaction.mockReset();
  });

  it('requires explicit confirmation before opening a transaction', async () => {
    await expect(
      undoHistoricalEquipmentBackfill('user-1', {
        auditId: 'audit-1',
        confirmed: false,
      }),
    ).rejects.toThrow('explicit confirmation');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('atomically clears only sets that still match the audited snapshot', async () => {
    const snapshot = {
      gymEquipmentId: 'cable-a',
      equipmentNameSnapshot: 'Cable A',
      equipmentLoadSnapshot: { version: 1, equipmentType: 'CABLE', weightOptions: [20, 30, 40] },
    };
    const tx = {
      mcpHistoricalEquipmentBackfillAudit: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'audit-1',
          gymId: 'gym-xfit',
          exerciseId: 'exercise-row',
          equipmentId: 'cable-a',
          setIds: ['set-1', 'set-2'],
          equipmentSnapshot: snapshot,
          undoneAt: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      set: {
        findMany: vi.fn().mockResolvedValue([{ id: 'set-1' }, { id: 'set-2' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    transaction.mockImplementation((async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx)) as never);

    const result = await undoHistoricalEquipmentBackfill('user-1', {
      auditId: 'audit-1',
      confirmed: true,
    });

    expect(tx.set.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['set-1', 'set-2'] },
          exerciseId: 'exercise-row',
          gymEquipmentId: 'cable-a',
          equipmentNameSnapshot: 'Cable A',
          session: { userId: 'user-1', gymId: 'gym-xfit' },
        }),
        data: expect.objectContaining({
          gymEquipmentId: null,
          equipmentNameSnapshot: null,
        }),
      }),
    );
    expect(tx.mcpHistoricalEquipmentBackfillAudit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'audit-1', userId: 'user-1', undoneAt: null },
      }),
    );
    expect(result).toMatchObject({ auditId: 'audit-1', undoneSetCount: 2 });
  });

  it('fails closed before clearing anything when an audited set changed later', async () => {
    const tx = {
      mcpHistoricalEquipmentBackfillAudit: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'audit-1',
          gymId: 'gym-xfit',
          exerciseId: 'exercise-row',
          equipmentId: 'cable-a',
          setIds: ['set-1', 'set-2'],
          equipmentSnapshot: {
            gymEquipmentId: 'cable-a',
            equipmentNameSnapshot: 'Cable A',
            equipmentLoadSnapshot: { version: 1, equipmentType: 'CABLE' },
          },
          undoneAt: null,
        }),
        updateMany: vi.fn(),
      },
      set: {
        findMany: vi.fn().mockResolvedValue([{ id: 'set-1' }]),
        updateMany: vi.fn(),
      },
    };
    transaction.mockImplementation((async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx)) as never);

    await expect(
      undoHistoricalEquipmentBackfill('user-1', {
        auditId: 'audit-1',
        confirmed: true,
      }),
    ).rejects.toThrow('exactly match');

    expect(tx.set.updateMany).not.toHaveBeenCalled();
    expect(tx.mcpHistoricalEquipmentBackfillAudit.updateMany).not.toHaveBeenCalled();
  });
});
