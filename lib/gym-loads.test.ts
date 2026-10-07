import { describe, expect, it } from 'vitest';
import {
  constrainGymWeight,
  gymWeightOptions,
  constrainGymWeightAtOrBelow,
  constructibleBarbellWeights,
  itemStackAppliesToExercise,
  itemStackStopsApplying,
} from '@/lib/gym-loads';

describe('saved gym load constraints', () => {
  it('steps down to an actually available dumbbell across inventory gaps', () => {
    const weight = constrainGymWeight(17.1, 19, {
      equipmentType: 'DUMBBELL',
      dumbbellWeights: [10, 12, 14, 15, 16, 19],
    });
    expect(weight).toBe(16);
  });

  it('steps up to the next available dumbbell instead of inventing a load', () => {
    const weight = constrainGymWeight(17, 16, {
      equipmentType: 'DUMBBELL',
      dumbbellWeights: [10, 12, 14, 15, 16, 19],
    });
    expect(weight).toBe(19);
  });

  it('builds barbell options only from a saved bar and symmetric plate pairs', () => {
    const options = constructibleBarbellWeights([20], [1.25, 2.5], 30);
    expect(options).toContain(20);
    expect(options).toContain(22.5);
    expect(options).toContain(25);
    expect(options).not.toContain(21.25);
    expect(
      constrainGymWeight(23.75, 25, {
        equipmentType: 'BARBELL',
        barWeights: [20],
        plateWeights: [1.25, 2.5],
      }),
    ).toBe(22.5);
  });

  it('uses explicit machine stack values when configured', () => {
    expect(
      constrainGymWeight(47, 50, {
        equipmentType: 'MACHINE',
        weightOptions: [10, 20, 30, 40, 50, 60],
      }),
    ).toBe(40);
  });

  it('caps a recommendation without jumping over the ceiling across an inventory gap', () => {
    expect(
      constrainGymWeightAtOrBelow(17, {
        equipmentType: 'DUMBBELL',
        dumbbellWeights: [10, 12, 14, 16, 19],
      }),
    ).toBe(16);
  });

  it('snaps OTHER equipment to its configured options in both helpers', () => {
    // The progression helper and the return-to-training option list must
    // agree: a kettlebell rack saved as OTHER with explicit options is real
    // inventory, not a free-form load (issue #324).
    const kettlebells = { equipmentType: 'OTHER' as const, weightOptions: [12, 16, 20, 24] };
    expect(gymWeightOptions(kettlebells, 18)).toEqual([12, 16, 20, 24]);
    expect(constrainGymWeight(18, 16, kettlebells)).toBe(20);
    expect(constrainGymWeight(14, 16, kettlebells)).toBe(12);
    expect(constrainGymWeight(18, 16, { equipmentType: 'OTHER' })).toBe(18);
  });

  it('constrains a barbell target from the same option list the return helpers use', () => {
    const rack = { equipmentType: 'BARBELL' as const, barWeights: [20], plateWeights: [5, 10] };
    const options = gymWeightOptions(rack, 60);
    expect(options).toContain(60);
    expect(options).toContain(70);
    expect(options).not.toContain(65);
    expect(constrainGymWeight(63, 60, rack)).toBe(70);
    expect(constrainGymWeight(230, 220, rack)).toBe(230);
  });

  it('falls back to the calculated load when no inventory is configured', () => {
    expect(constrainGymWeight(17.5, 20, { equipmentType: 'DUMBBELL' })).toBe(17.5);
  });
});

describe('item stack inheritance', () => {
  it('does not copy a machine or cable stack onto an OTHER exercise (#348)', () => {
    // OTHER is the default equipment type, so an AI-generated exercise such as
    // a landmine press must not inherit a linked cable station's stack.
    expect(itemStackAppliesToExercise('OTHER', 'CABLE')).toBe(false);
    expect(itemStackAppliesToExercise('OTHER', 'MACHINE')).toBe(false);
  });

  it('copies a stack onto a machine or cable exercise', () => {
    expect(itemStackAppliesToExercise('MACHINE', 'MACHINE')).toBe(true);
    expect(itemStackAppliesToExercise('CABLE', 'CABLE')).toBe(true);
    expect(itemStackAppliesToExercise('MACHINE', 'CABLE')).toBe(true);
    expect(itemStackAppliesToExercise('CABLE', 'OTHER')).toBe(true);
  });

  it('keeps OTHER-to-OTHER inheritance, where the rack is the inventory', () => {
    expect(itemStackAppliesToExercise('OTHER', 'OTHER')).toBe(true);
  });

  it('never copies a stack onto an exercise that loads itself', () => {
    expect(itemStackAppliesToExercise('DUMBBELL', 'MACHINE')).toBe(false);
    expect(itemStackAppliesToExercise('BARBELL', 'CABLE')).toBe(false);
    expect(itemStackAppliesToExercise('BODYWEIGHT', 'MACHINE')).toBe(false);
    expect(itemStackAppliesToExercise('CARDIO', 'OTHER')).toBe(false);
  });

  it('ignores items that carry no stack', () => {
    expect(itemStackAppliesToExercise('MACHINE', 'DUMBBELL')).toBe(false);
    expect(itemStackAppliesToExercise('MACHINE', 'BARBELL')).toBe(false);
    expect(itemStackAppliesToExercise('OTHER', 'BODYWEIGHT')).toBe(false);
  });
  it('stops applying when a stack the exercise inherited is taken away (#386)', () => {
    // A machine exercise holds the item's stack through a MACHINE -> CABLE
    // move, because the stack still applies to it under either type...
    expect(itemStackStopsApplying('MACHINE', 'MACHINE', 'CABLE')).toBe(false);
    expect(itemStackStopsApplying('CABLE', 'CABLE', 'MACHINE')).toBe(false);
    // ...and loses it when the item stops carrying a stack at all.
    expect(itemStackStopsApplying('MACHINE', 'CABLE', 'DUMBBELL')).toBe(true);
    expect(itemStackStopsApplying('CABLE', 'MACHINE', 'BARBELL')).toBe(true);
    expect(itemStackStopsApplying('MACHINE', 'OTHER', 'BODYWEIGHT')).toBe(true);
    // OTHER-to-OTHER inheritance ends the same way when the rack item moves on.
    expect(itemStackStopsApplying('OTHER', 'OTHER', 'MACHINE')).toBe(true);
  });

  it('keeps deliberate load options across a type change that never applied (#386)', () => {
    // The kettlebell-rack case of #324: an OTHER exercise linked to a station
    // item that moves MACHINE -> CABLE keeps the options a trainee set through
    // the gym config form, because the stack applied under neither type.
    expect(itemStackStopsApplying('OTHER', 'MACHINE', 'CABLE')).toBe(false);
    expect(itemStackStopsApplying('OTHER', 'CABLE', 'MACHINE')).toBe(false);
    expect(itemStackStopsApplying('OTHER', 'CABLE', 'OTHER')).toBe(false);
  });

  it('never clears options on an exercise that never inherited a stack', () => {
    expect(itemStackStopsApplying('DUMBBELL', 'CABLE', 'MACHINE')).toBe(false);
    expect(itemStackStopsApplying('BARBELL', 'MACHINE', 'CABLE')).toBe(false);
    expect(itemStackStopsApplying('BODYWEIGHT', 'OTHER', 'CABLE')).toBe(false);
    // A brand new item has no previous type to transition from.
    expect(itemStackStopsApplying('OTHER', null, 'CABLE')).toBe(false);
    expect(itemStackStopsApplying('OTHER', undefined, 'MACHINE')).toBe(false);
  });
});
