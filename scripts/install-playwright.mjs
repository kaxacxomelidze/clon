import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const clonerDir = resolve(root, 'packages', 'cloner');
const playwrightCli = resolve(clonerDir, 'node_modules', 'playwright', 'cli.js');

const result = spawnSync(process.execPath, [playwrightCli, 'install', 'chromium'], {
  cwd: clonerDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: '0',
  },
});

if (result.error) {
  console.error(result.error.message);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
