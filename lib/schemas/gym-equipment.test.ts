import { describe, expect, it } from 'vitest';
import { gymEquipmentImageSchema, gymEquipmentUpsertSchema } from './gym-equipment';

describe('gym equipment schemas', () => {
  it('normalizes a complete equipment input without inventing omitted update fields', () => {
    const parsed = gymEquipmentUpsertSchema.parse({
      equipmentId: ' equipment-1 ',
      name: '  Cable station  ',
      equipmentType: 'CABLE',
      quantity: 2,
      weightOptions: [20, 10, 20],
      exerciseIds: ['exercise-1'],
    });

    expect(parsed).toMatchObject({
      equipmentId: 'equipment-1',
      name: 'Cable station',
      quantity: 2,
      weightOptions: [10, 20],
      exerciseIds: ['exercise-1'],
    });
    expect(parsed.markExercisesAvailable).toBeUndefined();

    const minimal = gymEquipmentUpsertSchema.parse({
      name: 'Cable station',
      equipmentType: 'CABLE',
    });
    expect(minimal.quantity).toBeUndefined();
    expect(minimal.weightOptions).toBeUndefined();
    expect(minimal.exerciseIds).toBeUndefined();
    expect(minimal.markExercisesAvailable).toBeUndefined();
  });

  it('requires exactly one safe equipment image source', () => {
    expect(
      gymEquipmentImageSchema.safeParse({ imageUrl: 'http://unsafe.test/image.jpg' }).success,
    ).toBe(false);
    expect(
      gymEquipmentImageSchema.safeParse({ imageBase64: 'abcd', mimeType: 'image/gif' }).success,
    ).toBe(false);
    expect(
      gymEquipmentImageSchema.safeParse({
        imageUrl: 'https://example.test/image.jpg',
        imageBase64: 'abcd',
        mimeType: 'image/jpeg',
      }).success,
    ).toBe(false);
    expect(
      gymEquipmentImageSchema.safeParse({ imageBase64: 'abcd', mimeType: 'image/jpeg' }).success,
    ).toBe(true);
  });
});
