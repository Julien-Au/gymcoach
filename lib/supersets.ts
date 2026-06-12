// ============================================================
// Supersets (issue #146, slice 1) - program-level pairing
// ============================================================
// Exercises of one workout sharing the same ProgramExercise.supersetGroup
// number form a superset; null means standalone. The stored numbers are
// arbitrary bookkeeping: everything user-facing (A1/A2 labels, presentation
// order) is derived on read by these pure helpers, so unpairing or deleting
// a member never requires renumbering writes. A group needs at least two
// members to count as a superset - a singleton group renders as standalone.

export interface SupersetItem {
  id: string;
  order: number;
  supersetGroup: number | null;
}

// Bounds shared by the Zod schema and the builder UI: group numbers 1-9,
// i.e. at most 9 supersets per workout (letters A-I).
export const MIN_SUPERSET_GROUP = 1;
export const MAX_SUPERSET_GROUP = 9;

export interface SupersetView<T extends SupersetItem> {
  // Items sorted by `order`, except that members of a real superset group
  // (>= 2 members) are pulled together at the first member's position,
  // keeping their relative order. Standalone items keep their position.
  ordered: T[];
  // item id -> "A1" / "A2" / "B1"... only for members of real groups.
  // Letters follow the order groups first appear in; numbers follow the
  // member order within the group.
  labels: Map<string, string>;
  // item id -> the stored group number, only for members of real groups
  // (singleton groups are treated as standalone and excluded).
  groupById: Map<string, number>;
}

export function buildSupersetView<T extends SupersetItem>(items: T[]): SupersetView<T> {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const memberCount = new Map<number, number>();
  for (const it of sorted) {
    if (it.supersetGroup != null) {
      memberCount.set(it.supersetGroup, (memberCount.get(it.supersetGroup) ?? 0) + 1);
    }
  }

  const ordered: T[] = [];
  const labels = new Map<string, string>();
  const groupById = new Map<string, number>();
  const emitted = new Set<string>();
  let letterIndex = 0;

  for (const it of sorted) {
    if (emitted.has(it.id)) continue;
    const group = it.supersetGroup;
    if (group != null && (memberCount.get(group) ?? 0) >= 2) {
      const letter = String.fromCharCode(65 + letterIndex); // A, B, C...
      letterIndex += 1;
      let memberNumber = 1;
      for (const member of sorted) {
        if (member.supersetGroup === group && !emitted.has(member.id)) {
          ordered.push(member);
          emitted.add(member.id);
          labels.set(member.id, `${letter}${memberNumber}`);
          groupById.set(member.id, group);
          memberNumber += 1;
        }
      }
    } else {
      ordered.push(it);
      emitted.add(it.id);
    }
  }
  return { ordered, labels, groupById };
}

// The contiguous [start, end] index span of the current item's group in the
// presentation order, or null when the item is standalone.
function groupSpan<T extends SupersetItem>(
  view: SupersetView<T>,
  currentIdx: number,
): { start: number; end: number } | null {
  const current = view.ordered[currentIdx];
  if (!current) return null;
  const group = view.groupById.get(current.id);
  if (group == null) return null;
  let start = currentIdx;
  while (start > 0 && view.groupById.get(view.ordered[start - 1]!.id) === group) start -= 1;
  let end = currentIdx;
  while (
    end + 1 < view.ordered.length &&
    view.groupById.get(view.ordered[end + 1]!.id) === group
  ) {
    end += 1;
  }
  return { start, end };
}

// Where the runner should auto-advance to once the rest after a logged
// working set ends. `remaining` returns how many target working sets are
// still to log for an item (<= 0 when complete), INCLUDING the set just
// logged on the current item.
// - Standalone (unchanged behavior): the next exercise once the current one
//   has completed its target sets, otherwise stay (null).
// - Superset member (the A1/A2 flow): alternate to the next member of the
//   group (cycling) that still has sets remaining; when every member is
//   complete, the exercise right after the group; otherwise stay.
export function nextAutoAdvanceIndex<T extends SupersetItem>(
  view: SupersetView<T>,
  currentIdx: number,
  remaining: (item: T, idx: number) => number,
): number | null {
  const items = view.ordered;
  const current = items[currentIdx];
  if (!current) return null;

  const span = groupSpan(view, currentIdx);
  if (!span) {
    if (remaining(current, currentIdx) > 0) return null;
    return currentIdx + 1 < items.length ? currentIdx + 1 : null;
  }

  const size = span.end - span.start + 1;
  for (let step = 1; step < size; step += 1) {
    const idx = span.start + ((currentIdx - span.start + step) % size);
    if (remaining(items[idx]!, idx) > 0) return idx;
  }
  // Every other member is done: stay while the current one has sets left.
  if (remaining(current, currentIdx) > 0) return null;
  return span.end + 1 < items.length ? span.end + 1 : null;
}

// Where the Next button goes (manual navigation, presentation order).
// - Standalone (unchanged behavior): the next exercise, or null at the end
//   of the workout (button disabled).
// - Superset member: linear within the group; from the LAST member it cycles
//   back to the first OTHER member that still has working sets remaining,
//   and advances past the group otherwise. Deliberately never points at the
//   current item itself, so repeated taps can always leave the group - a
//   user is never trapped cycling in place.
export function nextNavIndex<T extends SupersetItem>(
  view: SupersetView<T>,
  currentIdx: number,
  remaining: (item: T, idx: number) => number,
): number | null {
  const items = view.ordered;
  const current = items[currentIdx];
  if (!current) return null;

  const span = groupSpan(view, currentIdx);
  if (!span) {
    return currentIdx + 1 < items.length ? currentIdx + 1 : null;
  }
  if (currentIdx < span.end) return currentIdx + 1;
  // Last member: cycle back while another member is unfinished.
  for (let idx = span.start; idx < span.end; idx += 1) {
    if (idx !== currentIdx && remaining(items[idx]!, idx) > 0) return idx;
  }
  return span.end + 1 < items.length ? span.end + 1 : null;
}

// The smallest free group number of a workout (for "pair with previous" when
// the previous row has no group yet), or null when all are in use.
export function smallestFreeGroup(items: SupersetItem[]): number | null {
  const used = new Set(items.map((i) => i.supersetGroup).filter((g) => g != null));
  for (let g = MIN_SUPERSET_GROUP; g <= MAX_SUPERSET_GROUP; g += 1) {
    if (!used.has(g)) return g;
  }
  return null;
}
