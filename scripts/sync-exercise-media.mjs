import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve(process.argv[2] ?? '');
if (!sourceRoot || !fs.existsSync(path.join(sourceRoot, 'dist', 'exercises.json'))) {
  throw new Error('Pass the path to a free-exercise-db checkout.');
}

const appCatalog = JSON.parse(fs.readFileSync('data/exercise-media.json', 'utf8'));
const sourceCatalog = JSON.parse(
  fs.readFileSync(path.join(sourceRoot, 'dist', 'exercises.json'), 'utf8'),
);
const byId = new Map(sourceCatalog.map((exercise) => [exercise.id, exercise]));
const destinationRoot = path.resolve('public', 'exercise-media', 'free-exercise-db');
fs.mkdirSync(destinationRoot, { recursive: true });

for (const group of appCatalog.groups) {
  const exercise = byId.get(group.datasetId);
  if (!exercise) throw new Error(`Unknown free-exercise-db id: ${group.datasetId}`);
  if (!Array.isArray(exercise.images) || exercise.images.length < 2) {
    throw new Error(`Exercise ${group.datasetId} does not have two frames.`);
  }
  const targetDirectory = path.join(destinationRoot, group.datasetId);
  fs.mkdirSync(targetDirectory, { recursive: true });
  for (const [index, relativePath] of exercise.images.slice(0, 2).entries()) {
    fs.copyFileSync(
      path.join(sourceRoot, 'exercises', relativePath),
      path.join(targetDirectory, `${index}.jpg`),
    );
  }
}

fs.copyFileSync(path.join(sourceRoot, 'LICENSE.md'), path.join(destinationRoot, 'LICENSE.md'));
fs.writeFileSync(
  path.join(destinationRoot, 'README.md'),
  [
    '# Exercise media',
    '',
    'Source: https://github.com/yuhonas/free-exercise-db',
    'License: Public domain (Unlicense). See LICENSE.md.',
    '',
    'Only the exercise frames referenced by data/exercise-media.json are vendored here.',
    '',
  ].join('\n'),
);

console.log(`Synced ${appCatalog.groups.length} exercise media groups to ${destinationRoot}.`);
