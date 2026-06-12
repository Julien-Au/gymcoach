import { describe, it, expect } from 'vitest';
import {
  buildSupersetView,
  nextAutoAdvanceIndex,
  nextNavIndex,
  smallestFreeGroup,
  MAX_SUPERSET_GROUP,
} from './supersets';

interface Item {
  id: string;
  order: number;
  supersetGroup: number | null;
}

function item(id: string, order: number, supersetGroup: number | null = null): Item {
  return { id, order, supersetGroup };
}

describe('buildSupersetView', () => {
  it('keeps standalone exercises in order with no labels', () => {
    const view = buildSupersetView([item('b', 2), item('a', 1), item('c', 3)]);
    expect(view.ordered.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(view.labels.size).toBe(0);
    expect(view.groupById.size).toBe(0);
  });

  it('labels group members A1/A2 and letters follow group appearance', () => {
    const view = buildSupersetView([
      item('bench', 1, 7),
      item('row', 2, 7),
      item('squat', 3),
      item('curl', 4, 2),
      item('ext', 5, 2),
    ]);
    expect(view.ordered.map((i) => i.id)).toEqual(['bench', 'row', 'squat', 'curl', 'ext']);
    // Stored numbers (7 then 2) are cosmetic: letters renumber on read.
    expect(view.labels.get('bench')).toBe('A1');
    expect(view.labels.get('row')).toBe('A2');
    expect(view.labels.get('curl')).toBe('B1');
    expect(view.labels.get('ext')).toBe('B2');
    expect(view.labels.has('squat')).toBe(false);
  });

  it('pulls non-adjacent members together at the first member position', () => {
    const view = buildSupersetView([
      item('a1', 1, 1),
      item('solo', 2),
      item('a2', 3, 1),
    ]);
    expect(view.ordered.map((i) => i.id)).toEqual(['a1', 'a2', 'solo']);
    expect(view.labels.get('a2')).toBe('A2');
  });

  it('treats a singleton group as standalone (no label, no group)', () => {
    const view = buildSupersetView([item('a', 1, 3), item('b', 2)]);
    expect(view.ordered.map((i) => i.id)).toEqual(['a', 'b']);
    expect(view.labels.size).toBe(0);
    expect(view.groupById.has('a')).toBe(false);
  });

  it('supports groups of three (A1/A2/A3)', () => {
    const view = buildSupersetView([
      item('x', 1, 1),
      item('y', 2, 1),
      item('z', 3, 1),
    ]);
    expect(view.labels.get('z')).toBe('A3');
  });
});

describe('nextAutoAdvanceIndex', () => {
  // remaining() already accounts for the set just logged on the current item.
  it('standalone: advances only once the target sets are complete (pinned behavior)', () => {
    const view = buildSupersetView([item('a', 1), item('b', 2)]);
    expect(nextAutoAdvanceIndex(view, 0, () => 2)).toBeNull(); // sets left -> stay
    expect(nextAutoAdvanceIndex(view, 0, () => 0)).toBe(1); // complete -> advance
    expect(nextAutoAdvanceIndex(view, 1, () => 0)).toBeNull(); // last exercise
  });

  it('superset: alternates to the other member that still has sets', () => {
    const view = buildSupersetView([item('a1', 1, 1), item('a2', 2, 1), item('b', 3)]);
    // Logged a set on A1, A2 still has sets -> go to A2 even if A1 has more.
    expect(nextAutoAdvanceIndex(view, 0, () => 1)).toBe(1);
    // Logged a set on A2, A1 still has sets -> back to A1.
    expect(nextAutoAdvanceIndex(view, 1, () => 1)).toBe(0);
  });

  it('superset: stays on the current member when the others are done', () => {
    const view = buildSupersetView([item('a1', 1, 1), item('a2', 2, 1), item('b', 3)]);
    const remaining = (i: Item) => (i.id === 'a1' ? 2 : 0);
    expect(nextAutoAdvanceIndex(view, 0, remaining)).toBeNull();
  });

  it('superset: advances past the group once every member is complete', () => {
    const view = buildSupersetView([item('a1', 1, 1), item('a2', 2, 1), item('b', 3)]);
    expect(nextAutoAdvanceIndex(view, 1, () => 0)).toBe(2);
    // Group at the end of the workout -> nothing after it.
    const tail = buildSupersetView([item('b', 1), item('a1', 2, 1), item('a2', 3, 1)]);
    expect(nextAutoAdvanceIndex(tail, 2, () => 0)).toBeNull();
  });
});

describe('nextNavIndex', () => {
  it('standalone: next exercise, null at the end (pinned behavior)', () => {
    const view = buildSupersetView([item('a', 1), item('b', 2)]);
    expect(nextNavIndex(view, 0, () => 5)).toBe(1);
    expect(nextNavIndex(view, 1, () => 5)).toBeNull();
  });

  it('cycles within the group before advancing', () => {
    const view = buildSupersetView([item('a1', 1, 1), item('a2', 2, 1), item('b', 3)]);
    // A1 -> A2 (linear within the group).
    expect(nextNavIndex(view, 0, () => 1)).toBe(1);
    // A2 (last member) -> back to A1 while A1 has sets remaining.
    expect(nextNavIndex(view, 1, (i) => (i.id === 'a1' ? 1 : 0))).toBe(0);
    // A2 -> past the group once A1 is done (never traps the user in place).
    expect(nextNavIndex(view, 1, (i) => (i.id === 'a2' ? 1 : 0))).toBe(2);
    expect(nextNavIndex(view, 1, () => 0)).toBe(2);
  });

  it('group at the end of the workout still cycles, then disables', () => {
    const view = buildSupersetView([item('b', 1), item('a1', 2, 1), item('a2', 3, 1)]);
    expect(nextNavIndex(view, 2, (i) => (i.id === 'a1' ? 1 : 0))).toBe(1);
    expect(nextNavIndex(view, 2, () => 0)).toBeNull();
  });
});

describe('smallestFreeGroup', () => {
  it('returns the smallest unused group number', () => {
    expect(smallestFreeGroup([item('a', 1, 1), item('b', 2, 3)])).toBe(2);
    expect(smallestFreeGroup([])).toBe(1);
  });

  it('returns null when all group numbers are taken', () => {
    const items = Array.from({ length: MAX_SUPERSET_GROUP }, (_, i) =>
      item(`x${i}`, i, i + 1),
    );
    expect(smallestFreeGroup(items)).toBeNull();
  });
});
