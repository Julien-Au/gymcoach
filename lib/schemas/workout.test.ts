import { describe, it, expect } from 'vitest';
import { workoutInputSchema } from './workout';

describe('workoutInputSchema', () => {
  it('accepts a name with a valid day of week', () => {
    const parsed = workoutInputSchema.parse({ name: 'Push', dayOfWeek: 1 });
    expect(parsed).toEqual({ name: 'Push', dayOfWeek: 1 });
  });

  it('trims the name and rejects an empty one', () => {
    expect(workoutInputSchema.parse({ name: '  Pull  ' }).name).toBe('Pull');
    expect(workoutInputSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('normalizes an empty-string day of week to null', () => {
    expect(workoutInputSchema.parse({ name: 'Legs', dayOfWeek: '' }).dayOfWeek).toBeNull();
  });

  it('coerces a numeric-string day and rejects out-of-range days', () => {
    expect(workoutInputSchema.parse({ name: 'Legs', dayOfWeek: '3' }).dayOfWeek).toBe(3);
    expect(workoutInputSchema.safeParse({ name: 'Legs', dayOfWeek: 8 }).success).toBe(false);
    expect(workoutInputSchema.safeParse({ name: 'Legs', dayOfWeek: 0 }).success).toBe(false);
  });
});
