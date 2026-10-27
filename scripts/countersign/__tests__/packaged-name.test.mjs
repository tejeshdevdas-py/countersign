import assert from 'node:assert/strict';
import test from 'node:test';

import { packagedAppName } from '../../../apps/desktop/scripts/ci/lib.mjs';
import { artifactBaseName } from '../../../apps/desktop/scripts/ci/package-lib.mjs';

test('the packaged executable and install folder are named Countersign for global and cn', () => {
  assert.equal(packagedAppName('global'), 'Countersign');
  assert.equal(packagedAppName('cn'), 'Countersign');
  assert.equal(packagedAppName(), 'Countersign');
});

test('the installer file name starts with Countersign', () => {
  assert.equal(artifactBaseName({ versionless: true }), 'Countersign-unversioned');
  assert.equal(artifactBaseName({ versionless: false, version: '1.2.3' }), 'Countersign-1.2.3');
});
