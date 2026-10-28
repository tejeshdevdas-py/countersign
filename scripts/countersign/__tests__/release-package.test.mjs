/**
 * Countersign (residual round, build-6): `pnpm release:package --version ...`
 * is refused under LOCAL_ONLY before `scripts/ensure-deps.mjs` runs, so a
 * refused build never repairs or reinstalls dependencies first.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { releasePackageSteps } from '../release-package.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'release-package.mjs');

test('under the real LOCAL_ONLY switch --version is refused before any step', () => {
  for (const argv of [
    ['--', '--platform', 'win32', '--version', '1.2.3'],
    ['--version', 'patch'],
    ['--version=1.2.3'],
  ]) {
    assert.throws(() => releasePackageSteps(argv), /--version is not available in Countersign/);
  }
});

test('without --version the steps are ensure-deps, then packaging with the same arguments', () => {
  const argv = ['--', '--platform', 'win32', '--allow-unsigned', '--skip-smoke'];
  const steps = releasePackageSteps(argv);
  assert.equal(steps.length, 2);
  assert.match(steps[0].join(' ').replace(/\\/g, '/'), /scripts\/ensure-deps\.mjs$/);
  assert.match(steps[1][0].replace(/\\/g, '/'), /apps\/desktop\/scripts\/package-desktop\.mjs$/);
  assert.deepEqual(steps[1].slice(1), argv);
});

test('with the switch off, --version is left to upstream packaging', () => {
  const steps = releasePackageSteps(['--version', '1.2.3'], false);
  assert.deepEqual(steps[1].slice(1), ['--version', '1.2.3']);
});

test('the command exits 1 with the refusal and starts no dependency check', () => {
  const result = spawnSync(process.execPath, [SCRIPT, '--', '--platform', 'win32', '--version', '1.2.3'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ERROR: --version is not available in Countersign/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /ensure-deps/);
});
