// Bodyweight history helpers (issue #99).
//
// User.bodyweight stays the single "current value" the rest of the app reads
// (effective load on bodyweight exercises, coach payload). The BodyweightEntry
// table is the history behind it; these pure helpers derive what the current
// value should be after a mutation so the routes and tests share one rule.

export interface BodyweightEntryLike {
  weightKg: number;
  measuredAt: Date;
}

// The weight of the most recent entry, or null when there is none. Ties on
// measuredAt resolve to the later element in the array; the routes order
// their queries by (measuredAt asc, id asc), so a tie deterministically goes
// to the highest id, i.e. the latest insert (issue #107).
export function currentBodyweightFromEntries(
  entries: BodyweightEntryLike[],
): number | null {
  let newest: BodyweightEntryLike | null = null;
  for (const entry of entries) {
    if (!newest || entry.measuredAt.getTime() >= newest.measuredAt.getTime()) {
      newest = entry;
    }
  }
  return newest ? newest.weightKg : null;
}
