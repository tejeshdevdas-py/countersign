/**
 * Countersign guard contract: forge.config.ts calls the Countersign packaging
 * steps in forge-countersign.ts at the right hook. The steps themselves are
 * unit-tested on fixture trees; forge.config.ts builds native helpers when it
 * is loaded, so a unit test cannot import it, and this guard-tier test pins
 * the wiring in its source.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = resolve(__dirname, '..', '..', '..', '..');
const forge = readFileSync(resolve(DESKTOP_ROOT, 'forge.config.ts'), 'utf8');

function occurrences(part: string): number {
  return forge.split(part).length - 1;
}

/** The body of a hook, from `<name>: async (` to the next hook or the end of `hooks`. */
function hookBody(name: string): string {
  const start = forge.indexOf(`    ${name}: async (`);
  expect(start, `${name} hook exists`).toBeGreaterThan(-1);
  const next = forge.slice(start + 1).search(/\n {4}[A-Za-z]+: async \(|\n {2}\},\n/);
  return forge.slice(start, next === -1 ? undefined : start + 1 + next);
}

describe('forge.config.ts Countersign packaging wiring', () => {
  it('M-B5: prePackage stages the engines through the ensure step under LOCAL_ONLY', () => {
    expect(hookBody('prePackage')).toMatch(
      /if \(LOCAL_ONLY\) \{\s*stageCountersignAgentBinaries\(targetPlatform, targetArch\);/,
    );
    expect(occurrences('ensure: spawnEnsureAgentBinaries(')).toBe(1);
    expect(occurrences('const COUNTERSIGN_AGENT_BINARIES')).toBe(0);
  });

  it('M-B6: vec0 is checked for a missing, tiny or LFS-pointer file before it is copied', () => {
    const start = forge.indexOf('function copySqliteVecBinary(');
    const body = forge.slice(start, forge.indexOf('\nfunction ', start + 1));
    const check = body.indexOf('assertRealLfsBinary(src, ');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(body.indexOf('fs.copyFileSync(src, '));
    // Only non-Windows targets keep upstream's skip when the file is absent.
    expect(body).toContain("if (!fs.existsSync(src) && targetPlatform !== 'win32') {");
  });

  it('M-B1: the Windows native rebuild runs with the build folder trimmed from the addon', () => {
    const start = forge.indexOf('async function rebuildNativeDepsInPackage(');
    const body = forge.slice(start, forge.indexOf('\nconst isDev', start));
    expect(body).toMatch(
      /platform === 'win32' && process\.platform === 'win32' \? msvcPathFreeBuildEnv\(buildPath\) : \{\}/,
    );
    expect(body).toMatch(/await withEnv\(rebuildEnv, \(\) =>\s*electronRebuild\(\{/);
    expect(body.split('electronRebuild(').length - 1).toBe(1);
  });

  it('M-B1: postPackage checks the Windows package for build intermediates and the user name', () => {
    const postPackage = hookBody('postPackage');
    const check = postPackage.indexOf(
      'assertCountersignPackagedOutputClean(buildPath, opts.platform);',
    );
    expect(check).toBeGreaterThan(postPackage.indexOf('signPackagedExes(buildPath);'));

    const start = forge.indexOf('function assertCountersignPackagedOutputClean(');
    const body = forge.slice(start, forge.indexOf('\nfunction ', start + 1));
    expect(body).toContain("if (platform !== 'win32') return;");
    expect(body).toContain('userName = os.userInfo().username;');
    expect(body).toContain(
      'publicIdentity: publicGithubIdentity(Object.values(BRAND_IDENTITY.appIdByRegion)),',
    );
    // The name is only handed to the check: never logged or written.
    expect(body.split('userName').length - 1).toBe(3);
    expect(/console\.\w+\([^;]*userName/.test(body)).toBe(false);
    expect(/writeFile|appendFile/.test(body)).toBe(false);
  });
});
