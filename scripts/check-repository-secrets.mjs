import { basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const result = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(result.stderr || 'Impossible de lire les fichiers suivis par Git.');
}

const trackedFiles = result.stdout.split('\0').filter(Boolean);
const forbiddenNames = new Set([
  '.env.quality',
  '.env.quality.local',
  '.env.hopstudio.test',
  '.env.hopstudio.test.local',
  '.env.hopstudio.test.local.',
]);
const forbidden = trackedFiles.filter((path) => {
  const name = basename(path);
  return (
    forbiddenNames.has(name) ||
    (name.startsWith('.env.') && name.endsWith('.local')) ||
    path.startsWith('quality-reports/')
  );
});

if (forbidden.length > 0) {
  console.error('Fichiers locaux ou rapports interdits dans Git :');
  for (const path of forbidden) console.error(`- ${path}`);
  process.exit(1);
}

console.log('Aucun fichier local de qualité ni rapport généré n’est suivi par Git.');
