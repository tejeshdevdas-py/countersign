/**
 * Countersign guard contract (Task 8 minor round, item 11): the app updater is
 * off, so no prompt the model reads tells it to use one. The host prompt and
 * its three headless copies say there is no built-in updater; the cindy_helper
 * update tools are wired through appUpdateToolDeps and the runtime catalog
 * note through hostCapabilitiesNote, both in src/main/countersign/appUpdateTools.ts,
 * whose behaviour is tested in appUpdateTools.test.ts. This guard-tier test
 * pins the prompt text and the two call sites in their source.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const DESKTOP_MAIN = resolve(__dirname, '..', '..');
const HEADLESS_PROFILES = resolve(DESKTOP_MAIN, '..', '..', '..', 'cindy-headless', 'profiles');

const PROMPTS: Array<[string, string]> = [
  ['host-system-prompt.md', resolve(DESKTOP_MAIN, 'maker-host', 'host-system-prompt.md')],
  ...['claude', 'codex', 'pi'].map((engine): [string, string] => [
    `headless ${engine} prompt.md`,
    resolve(HEADLESS_PROFILES, `cindy-production-${engine}`, 'prompt.md'),
  ]),
];

describe('model-facing updater text in Countersign', () => {
  it.each(PROMPTS)(
    '%s says there is no built-in updater and names no update tool',
    (_name, file) => {
      const text = readFileSync(file, 'utf8');
      expect(text).toContain('Countersign has no built-in updater');
      for (const stale of [
        'install_app_update',
        'check_app_update',
        'installs with its built-in updater',
        'Check for Updates',
      ]) {
        expect(text).not.toContain(stale);
      }
    },
  );

  it('registers the cindy_helper update tools only through appUpdateToolDeps', () => {
    const source = readFileSync(
      resolve(DESKTOP_MAIN, 'mcp-integrations', 'mcp-providers.ts'),
      'utf8',
    );
    expect(source).toContain('...appUpdateToolDeps(() => createAgentAppUpdateCallbacks(');
    expect(source).not.toMatch(/\bappUpdate:\s*createAgentAppUpdateCallbacks/);
  });

  it('builds the runtime catalog note through hostCapabilitiesNote', () => {
    const source = readFileSync(resolve(DESKTOP_MAIN, 'maker-host', 'index.ts'), 'utf8');
    const notes = source.match(/hostCapabilitiesNote:[^\n]*/g) ?? [];
    expect(notes.length).toBe(1);
    expect(notes[0]).toMatch(/^hostCapabilitiesNote: hostCapabilitiesNote\(/);
  });
});
