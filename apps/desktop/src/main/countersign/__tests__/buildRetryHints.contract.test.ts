/**
 * Countersign guard contract (final review M-B3): a build retry hint never
 * suggests `pnpm update:<kind>`. Run without a version, each
 * tools/<kind>/update.mjs fetches the newest upstream release and rewrites
 * tools/<kind>/latest.json, which moves the build off its tested pin.
 * `pnpm install:<kind>` re-runs the pinned version instead. Most of these
 * messages sit on download or packaging failure paths that no unit test can
 * reach without the network, so this guard-tier test pins their text.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '..');

function read(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

function occurrences(text: string, part: string): number {
  return text.split(part).length - 1;
}

const RETRY_HINT_FILES = [
  'scripts/ensure-agent-binaries.mjs',
  'scripts/ensure-dev-runtime-assets.mjs',
  'apps/desktop/forge.config.ts',
];

const rootScripts = JSON.parse(read('package.json')).scripts as Record<string, string>;

describe('Countersign build retry hints', () => {
  it.each(RETRY_HINT_FILES)('%s never suggests pnpm update:<kind>', (file) => {
    expect(occurrences(read(file), 'pnpm update:')).toBe(0);
  });

  it('ensure-agent-binaries suggests pnpm install:<kind> on every retry path', () => {
    const source = read('scripts/ensure-agent-binaries.mjs');
    expect(occurrences(source, 'updateScript}')).toBe(0);
    // The upstream failure, the two fallback branches and the final pin check.
    expect(occurrences(source, 'pnpm install:${kind}')).toBe(4);
    // A missing pin is restored from the repository, not re-pinned to the newest release.
    expect(occurrences(source, 'restore it from the repository')).toBe(1);
  });

  it('the dev runtime check suggests pnpm install:<kind>', () => {
    const source = read('scripts/ensure-dev-runtime-assets.mjs');
    expect(occurrences(source, '"pnpm install:${kind}"')).toBe(1);
  });

  it('forge ripgrep staging suggests pnpm install:ripgrep', () => {
    const source = read('apps/desktop/forge.config.ts');
    expect(occurrences(source, 'run "pnpm install:ripgrep" before packaging')).toBe(1);
  });

  it.each(['claude', 'codex', 'ripgrep', 'pi'])('pnpm install:%s exists', (kind) => {
    expect(typeof rootScripts[`install:${kind}`]).toBe('string');
  });
});
