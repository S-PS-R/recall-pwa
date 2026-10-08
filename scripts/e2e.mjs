import { spawnSync } from 'node:child_process';

// Always exercise the actual service worker under a repository subpath.
for (const args of [
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['node_modules/vite/bin/vite.js', 'build'],
  ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, VITE_BASE_PATH: '/quizrep/' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
