/**
 * Countersign packaging (final review M-B1): Forge rebuilds better-sqlite3
 * with MSVC inside the packager's temporary folder, which sits in the user
 * profile. Without help the addon records that folder twice: in the source
 * path Node's module registration keeps (__FILE__) and in the PDB path of its
 * debug directory. The rebuild environment trims both. The flags were checked
 * once by hand with node-gyp and MSVC on a probe addon; these tests pin the
 * environment the rebuild receives.
 */
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { msvcPathFreeBuildEnv, withEnv } from '../../../../forge-countersign';

const BUILD = path.resolve('packager-tmp', 'tmp-1', 'resources', 'app');
const LONG = path.resolve('packager-tmp-long', 'tmp-1', 'resources', 'app');

afterEach(() => {
  delete process.env.COUNTERSIGN_TEST_ENV_A;
  delete process.env.COUNTERSIGN_TEST_ENV_B;
});

describe('MSVC rebuild environment without the build folder', () => {
  it('trims the build folder from __FILE__ and keeps only the PDB file name', () => {
    expect(msvcPathFreeBuildEnv(BUILD, {}, (p) => p)).toEqual({
      _CL_: `"/d1trimfile:${BUILD}"`,
      _LINK_: '/PDBALTPATH:%_PDB%',
    });
  });

  it('also trims the resolved long form when the folder is given in its short form', () => {
    expect(msvcPathFreeBuildEnv(BUILD, {}, () => LONG)._CL_).toBe(
      `"/d1trimfile:${BUILD}" "/d1trimfile:${LONG}"`,
    );
  });

  it('keeps options the builder already set', () => {
    expect(msvcPathFreeBuildEnv(BUILD, { _CL_: '/MP', _LINK_: '/X' }, (p) => p)).toEqual({
      _CL_: `/MP "/d1trimfile:${BUILD}"`,
      _LINK_: '/X /PDBALTPATH:%_PDB%',
    });
  });

  it('drops a trailing separator, which would escape the closing quote', () => {
    expect(msvcPathFreeBuildEnv(`${BUILD}${path.sep}`, {}, (p) => p)._CL_).toBe(
      `"/d1trimfile:${BUILD}"`,
    );
  });

  it('falls back to the given folder when it cannot be resolved', () => {
    const fail = () => {
      throw new Error('ENOENT');
    };
    expect(msvcPathFreeBuildEnv(BUILD, {}, fail)._CL_).toBe(`"/d1trimfile:${BUILD}"`);
  });

  it('withEnv sets the variables for the call and restores them afterwards, also on failure', async () => {
    process.env.COUNTERSIGN_TEST_ENV_A = 'before';
    const seen = await withEnv(
      { COUNTERSIGN_TEST_ENV_A: 'during', COUNTERSIGN_TEST_ENV_B: 'set' },
      async () => [process.env.COUNTERSIGN_TEST_ENV_A, process.env.COUNTERSIGN_TEST_ENV_B],
    );
    expect(seen).toEqual(['during', 'set']);
    expect(process.env.COUNTERSIGN_TEST_ENV_A).toBe('before');
    expect('COUNTERSIGN_TEST_ENV_B' in process.env).toBe(false);

    await expect(
      withEnv({ COUNTERSIGN_TEST_ENV_A: 'during' }, async () => {
        throw new Error('rebuild failed');
      }),
    ).rejects.toThrow('rebuild failed');
    expect(process.env.COUNTERSIGN_TEST_ENV_A).toBe('before');
  });
});
