import catalog from '@/data/exercise-media.json';

export interface ExerciseMedia {
  datasetId: string;
  frames: [string, string];
  approximate: boolean;
  source: {
    name: string;
    url: string;
    license: string;
  };
}

const mediaByName = new Map<string, ExerciseMedia>();

for (const group of catalog.groups) {
  const media: ExerciseMedia = {
    datasetId: group.datasetId,
    frames: [
      `/exercise-media/free-exercise-db/${group.datasetId}/0.jpg`,
      `/exercise-media/free-exercise-db/${group.datasetId}/1.jpg`,
    ],
    approximate: 'approximate' in group && group.approximate === true,
    source: catalog.source,
  };
  for (const name of group.names) mediaByName.set(normalizeExerciseName(name), media);
}

function normalizeExerciseName(name: string): string {
  return name.trim().toLocaleLowerCase('en-US');
}

export function getExerciseMedia(name: string): ExerciseMedia | null {
  return mediaByName.get(normalizeExerciseName(name)) ?? null;
}

export function exerciseMediaCoverage(names: string[]): { covered: string[]; missing: string[] } {
  const covered: string[] = [];
  const missing: string[] = [];
  for (const name of names) (getExerciseMedia(name) ? covered : missing).push(name);
  return { covered, missing };
}
