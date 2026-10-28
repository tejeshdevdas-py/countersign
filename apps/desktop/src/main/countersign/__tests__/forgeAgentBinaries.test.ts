/**
 * Countersign packaging (final review M-B5): before the bundled engines are
 * staged into resources/agent-bin, ensure-agent-binaries runs for claude,
 * codex and pi, so each is checked against its pin (`.version` marker and,
 * for directory distributions, the install manifest). Staging alone checked
 * only that the executable existed, so a stale engine could ship after a
 * pin bump. Fixture trees only: the ensure step is injected, no download runs.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  COUNTERSIGN_AGENT_BINARIES,
  ensureAgentBinariesCommand,
  stageAgentBinaries,
} from '../../../../forge-countersign';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

const KEY = 'win32-x64';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-agent-bin-'));
  roots.push(root);
  const appsDir = path.join(root, 'apps');
  const destRoot = path.join(root, 'desktop', 'resources', 'agent-bin');
  const files = [
    ['claude-code-bin', 'claude.exe'],
    ['codex-package-bin', path.join('bin', 'codex.exe')],
    ['pi-bin', 'pi.exe'],
    ['pi-bin', path.join('theme', 'dark.json')],
  ] as const;
  const write = () => {
    for (const [binDir, file] of files) {
      const target = path.join(appsDir, binDir, KEY, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `${binDir} ${file}`);
    }
  };
  return { root, appsDir, destRoot, write };
}

describe('Countersign engine staging', () => {
  it('stages claude, codex and pi', () => {
    expect(COUNTERSIGN_AGENT_BINARIES.map((entry) => entry.kind)).toEqual([
      'claude',
      'codex',
      'pi',
    ]);
  });

  it('ensures the pinned engines before anything is copied', () => {
    const f = fixture();
    const calls: Array<{ kinds: readonly string[]; platformKey: string; staged: boolean }> = [];
    stageAgentBinaries({
      targetPlatform: 'win32',
      platformKey: KEY,
      appsDir: f.appsDir,
      destRoot: f.destRoot,
      ensure: (kinds, platformKey) => {
        calls.push({ kinds, platformKey, staged: fs.existsSync(f.destRoot) });
        f.write();
        return { status: 0 };
      },
    });
    expect(calls).toEqual([{ kinds: ['claude', 'codex', 'pi'], platformKey: KEY, staged: false }]);
    expect(fs.readFileSync(path.join(f.destRoot, 'claude-code', 'claude.exe'), 'utf8')).toBe(
      'claude-code-bin claude.exe',
    );
    expect(fs.existsSync(path.join(f.destRoot, 'codex-package', 'bin', 'codex.exe'))).toBe(true);
    expect(fs.existsSync(path.join(f.destRoot, 'pi', 'theme', 'dark.json'))).toBe(true);
  });

  it('stops when the ensure step fails, naming the retry command for each engine', () => {
    const f = fixture();
    f.write();
    const stage = () =>
      stageAgentBinaries({
        targetPlatform: 'win32',
        platformKey: KEY,
        appsDir: f.appsDir,
        destRoot: f.destRoot,
        ensure: () => ({ status: 1 }),
      });
    expect(stage).toThrow(/pnpm install:claude.*pnpm install:codex.*pnpm install:pi/);
    expect(stage).not.toThrow(/pnpm update:/);
    expect(fs.existsSync(f.destRoot)).toBe(false);
  });

  it('stops when the ensure step cannot start', () => {
    const f = fixture();
    f.write();
    expect(() =>
      stageAgentBinaries({
        targetPlatform: 'win32',
        platformKey: KEY,
        appsDir: f.appsDir,
        destRoot: f.destRoot,
        ensure: () => ({ status: null, error: new Error('spawn failed') }),
      }),
    ).toThrow(/spawn failed/);
    expect(fs.existsSync(f.destRoot)).toBe(false);
  });

  it('stops when an engine is still missing after the ensure step', () => {
    const f = fixture();
    expect(() =>
      stageAgentBinaries({
        targetPlatform: 'win32',
        platformKey: KEY,
        appsDir: f.appsDir,
        destRoot: f.destRoot,
        ensure: () => ({ status: 0 }),
      }),
    ).toThrow(/claude-code-bin win32-x64 missing .* after ensure/);
  });

  it('runs the repository ensure script for the given engines and platform', () => {
    const repoRoot = path.join('repo-root');
    const command = ensureAgentBinariesCommand(repoRoot, ['claude', 'codex', 'pi'], KEY);
    expect(command.command).toBe(process.execPath);
    expect(command.args).toEqual([
      path.join(repoRoot, 'scripts', 'ensure-agent-binaries.mjs'),
      '--kinds=claude,codex,pi',
      `--platform=${KEY}`,
    ]);
  });
});
