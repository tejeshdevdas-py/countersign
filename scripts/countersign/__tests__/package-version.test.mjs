/**
 * Countersign (final review M-B8): `pnpm release:package --version ...` is
 * refused under LOCAL_ONLY before any packaging step. A versioned build makes
 * an update package for the upstream updater (`-hotfix.zip`) and, for
 * major/minor/patch, reads the upstream release CDN for its baseline.
 * Countersign has no updater and no release channel.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { refuseVersionedPackaging } from '../package-version.mjs';

test('under the real LOCAL_ONLY switch an explicit version is refused', () => {
  assert.throws(
    () => refuseVersionedPackaging('1.2.3'),
    /--version is not available in Countersign/,
  );
});

test('under the real LOCAL_ONLY switch a bump keyword is refused', () => {
  for (const spec of ['major', 'minor', 'patch']) {
    assert.throws(() => refuseVersionedPackaging(spec), /Omit --version/);
  }
});

test('a versionless build (no --version) is allowed', () => {
  assert.doesNotThrow(() => refuseVersionedPackaging(null));
});

test('with the switch off, versioned packaging is left to upstream', () => {
  assert.doesNotThrow(() => refuseVersionedPackaging('1.2.3', false));
  assert.doesNotThrow(() => refuseVersionedPackaging('patch', false));
});

test('the refusal says why, without naming the upstream product', () => {
  assert.throws(
    () => refuseVersionedPackaging('1.2.3'),
    (error) => {
      assert.match(error.message, /update package/);
      assert.match(error.message, /no updater/);
      assert.doesNotMatch(error.message, /cindy/i);
      return true;
    },
  );
});
