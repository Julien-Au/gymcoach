// Live-session exercise selection travels in the URL as the ProgramExercise
// row id, not the exercise id: a workout may program the same exercise twice
// (two rows, one exerciseId) and the selection must round-trip to the row the
// lifter was on.
export function selectedExerciseIndex(
  exercises: ReadonlyArray<{ id: string }>,
  programExerciseId: string | undefined,
): number {
  if (!programExerciseId) return 0;
  const index = exercises.findIndex((exercise) => exercise.id === programExerciseId);
  return index >= 0 ? index : 0;
}

export function sessionExercisePath(sessionId: string, programExerciseId: string): string {
  return `/session/${encodeURIComponent(sessionId)}?programExerciseId=${encodeURIComponent(programExerciseId)}`;
}

export function exerciseDetailPath(exerciseId: string, returnTo: string): string {
  return `/exercises/${encodeURIComponent(exerciseId)}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function safeSessionReturnPath(value: string | undefined): string | null {
  if (!value) return null;
  return /^\/session\/[a-zA-Z0-9_-]+(?:\?programExerciseId=[a-zA-Z0-9_%.-]+)?$/u.test(value)
    ? value
    : null;
}
