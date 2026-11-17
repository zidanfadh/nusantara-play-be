/**
 * npm run db:reset -- --yes
 *
 * Deletes the LOCAL development database container AND its data volume
 * (nusantara-dev-db-data), then starts a fresh one. Both nusantara_play_dev
 * and nusantara_play_test are recreated empty; run `npm run db:setup`
 * afterwards. Only touches docker-compose.dev.yml; refuses to run without
 * the --yes flag.
 */
import { spawnSync } from 'child_process';

const COMPOSE = ['compose', '-f', 'docker-compose.dev.yml'];

function docker(args: string[]): void {
  console.log(`> docker ${args.join(' ')}`);
  const result = spawnSync('docker', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!process.argv.includes('--yes')) {
  console.error(
    'db:reset deletes the local Docker volume nusantara-dev-db-data ' +
      '(nusantara_play_dev and nusantara_play_test).\n' +
      'Re-run with the confirmation flag: npm run db:reset -- --yes',
  );
  process.exit(1);
}

docker([...COMPOSE, 'down', '--volumes']);
docker([...COMPOSE, 'up', '-d', '--wait']);
console.log('Fresh local database is up. Next: npm run db:setup');
