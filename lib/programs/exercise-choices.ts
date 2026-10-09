// The exercises a program editor may offer for one row of a workout: the
// catalog minus the exercises the workout already holds, because two rows for
// one exercise share one set pool in the live runner (issue #426). The row
// being edited keeps its own exercise selectable.
export function workoutExerciseChoices<T extends { id: string }>(
  catalog: readonly T[],
  workoutExerciseIds: Iterable<string>,
  keepExerciseId?: string,
): T[] {
  const taken = new Set(workoutExerciseIds);
  if (keepExerciseId) taken.delete(keepExerciseId);
  return catalog.filter((exercise) => !taken.has(exercise.id));
}
