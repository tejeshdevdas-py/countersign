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
});
