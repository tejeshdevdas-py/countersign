/**
 * Countersign: the build scripts' view of the LOCAL_ONLY switch.
 *
 * The switch is `export const LOCAL_ONLY = <true|false> as const;` in
 * packages/maker-shared/src/localOnly.ts, which the app imports. Plain Node
 * build scripts cannot import that TypeScript module, so they read the
 * declaration from it here rather than keep a copy that could drift. Anything
 * other than exactly one such declaration is an error, never a guess.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const LOCAL_ONLY_SOURCE = path.join('packages', 'maker-shared', 'src', 'localOnly.ts');

const DECLARATION = /^export const LOCAL_ONLY = (true|false) as const;\r?$/gm;

/** The value of LOCAL_ONLY in `<repoRoot>/packages/maker-shared/src/localOnly.ts`. */
export function readLocalOnlySwitch(repoRoot = REPO_ROOT) {
  const file = path.join(repoRoot, LOCAL_ONLY_SOURCE);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(
      `Cannot read the LOCAL_ONLY switch from ${LOCAL_ONLY_SOURCE}: ${error.code ?? error}`,
    );
  }
  const matches = [...text.matchAll(DECLARATION)];
  if (matches.length !== 1) {
    throw new Error(
      `Expected one "export const LOCAL_ONLY = true|false as const;" in ${LOCAL_ONLY_SOURCE}, found ${matches.length}`,
    );
  }
  return matches[0][1] === 'true';
}
