/**
 * Countersign: `pnpm release:package` entry point.
 *
 * Upstream's script ran `scripts/ensure-deps.mjs && .../package-desktop.mjs`,
 * and pnpm hands the command-line options to the last command only. So
 * package-desktop.mjs refused `--version` only after ensure-deps had run, and
 * ensure-deps may repair or reinstall dependencies. Under LOCAL_ONLY this
 * script refuses `--version` first, then runs the same two steps with the
 * same options.
 *
 * Exit codes: 1 when --version is refused, otherwise the first failing
 * step's exit code (0 when both steps pass).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readLocalOnlySwitch } from './local-only.mjs';
import { refuseVersionedPackaging } from './package-version.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENSURE_DEPS = path.join(REPO_ROOT, 'scripts', 'ensure-deps.mjs');
const PACKAGE_DESKTOP = path.join(REPO_ROOT, 'apps', 'desktop', 'scripts', 'package-desktop.mjs');

/** The `--version` value in the options, or null when there is none. */
function versionSpecOf(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--version') return argv[i + 1] ?? '';
    if (argv[i].startsWith('--version=')) return argv[i].slice('--version='.length);
  }
  return null;
}

/**
 * The commands `pnpm release:package` runs, each as `[script, ...options]`
 * for `node`. Throws the refusal for `--version` under LOCAL_ONLY.
 *
 * @param {string[]} argv the options after the script name
 * @param {boolean} [localOnly] the LOCAL_ONLY switch (read from the app's source by default)
 */
export function releasePackageSteps(argv, localOnly = readLocalOnlySwitch()) {
  refuseVersionedPackaging(versionSpecOf(argv), localOnly);
  return [[ENSURE_DEPS], [PACKAGE_DESKTOP, ...argv]];
}

function main(argv) {
  let steps;
  try {
    steps = releasePackageSteps(argv);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return 1;
  }
  for (const step of steps) {
    const result = spawnSync(process.execPath, step, { stdio: 'inherit' });
    if (result.error) {
      console.error(`ERROR: could not start ${path.basename(step[0])}: ${result.error.message}`);
      return 1;
    }
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
