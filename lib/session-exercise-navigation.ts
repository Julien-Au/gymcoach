export function selectedExerciseIndex(
  exercises: ReadonlyArray<{ exerciseId: string }>,
  exerciseId: string | undefined,
): number {
  if (!exerciseId) return 0;
  const index = exercises.findIndex((exercise) => exercise.exerciseId === exerciseId);
  return index >= 0 ? index : 0;
}

export function sessionExercisePath(sessionId: string, exerciseId: string): string {
  return `/session/${encodeURIComponent(sessionId)}?exerciseId=${encodeURIComponent(exerciseId)}`;
}

export function exerciseDetailPath(exerciseId: string, returnTo: string): string {
  return `/exercises/${encodeURIComponent(exerciseId)}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function safeSessionReturnPath(value: string | undefined): string | null {
  if (!value) return null;
  return /^\/session\/[a-zA-Z0-9_-]+(?:\?exerciseId=[a-zA-Z0-9_%.-]+)?$/u.test(value)
    ? value
    : null;
}
