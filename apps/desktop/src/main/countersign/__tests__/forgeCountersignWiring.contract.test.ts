/**
 * Countersign guard contract: forge.config.ts calls the Countersign packaging
 * steps in forge-countersign.ts at the right hook, and package-desktop.mjs
 * refuses --version first. The steps themselves are unit-tested; forge.config.ts
 * builds native helpers when it is loaded and package-desktop.mjs packages
 * when it is run, so no unit test can load either, and this guard-tier test
 * pins the wiring in their source.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = resolve(__dirname, '..', '..', '..', '..');
const forge = readFileSync(resolve(DESKTOP_ROOT, 'forge.config.ts'), 'utf8');
const packageDesktop = readFileSync(
  resolve(DESKTOP_ROOT, 'scripts', 'package-desktop.mjs'),
  'utf8',
);

function occurrences(part: string): number {
  return forge.split(part).length - 1;
}

/** The body of a hook, from `<name>: async (` to the next hook or the end of `hooks`. */
function hookBody(name: string): string {
  const start = forge.indexOf(`    ${name}: async (`);
  expect(start, `${name} hook exists`).toBeGreaterThan(-1);
  const next = forge.slice(start + 1).search(/\r?\n {4}[A-Za-z]+: async \(|\r?\n {2}\},\r?\n/);
  return forge.slice(start, next === -1 ? undefined : start + 1 + next);
}

describe('forge.config.ts Countersign packaging wiring', () => {
  it('M-F7: imports LOCAL_ONLY by package name, like the app does', () => {
    expect(occurrences("import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';")).toBe(1);
    expect(occurrences('packages/maker-shared/src/localOnly')).toBe(0);
  });

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

  it('M-L2: postPackage puts the root LICENSE and NOTICE into the packaged resources', () => {
    const postPackage = hookBody('postPackage');
    expect(postPackage).toMatch(
      /stageProjectLicense\(\s*packagedResourcesPath\(buildPath, opts\.platform\),\s*path\.join\(__dirname, '\.\.', '\.\.'\),\s*\);/,
    );
    // Before the Windows check, which then scans the final package.
    expect(postPackage.indexOf('stageProjectLicense(')).toBeLessThan(
      postPackage.indexOf('assertCountersignPackagedOutputClean('),
    );
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

describe('package-desktop.mjs Countersign wiring', () => {
  it('M-B8: refuses --version right after parsing the arguments, before any step', () => {
    expect(packageDesktop).toContain(
      "import { refuseVersionedPackaging } from '../../../scripts/countersign/package-version.mjs';",
    );
    expect(packageDesktop).toMatch(
      /args = parsePackageArgs\(process\.argv\.slice\(2\)\);\s*\/\/[^\n]*\n\s*refuseVersionedPackaging\(args\.versionSpec\);\s*\} catch \(err\) \{\s*console\.error\(`ERROR: \$\{err\.message\}`\);\s*process\.exit\(1\);/,
    );
  });
});
