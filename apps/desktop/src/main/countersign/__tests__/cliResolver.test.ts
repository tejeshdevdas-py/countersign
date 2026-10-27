import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveAgentBinary, type AgentEngine } from '../cliResolver';

const exe = (base: string): string => (process.platform === 'win32' ? `${base}.exe` : base);

const BUNDLED_RELATIVE: Record<AgentEngine, string> = {
  claude: exe('claude'),
  codex: path.join('bin', exe('codex')),
  rg: exe('rg'),
  pi: exe('pi'),
};

const ENGINES: AgentEngine[] = ['claude', 'codex', 'rg', 'pi'];
const BUNDLED_DIR = path.join('resources', 'agent-bin', 'engine');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveAgentBinary', () => {
  it.each(ENGINES)('%s: a bundled file wins and PATH is not consulted', (engine) => {
    const bundled = path.join(BUNDLED_DIR, BUNDLED_RELATIVE[engine]);
    const which = vi.fn(() => '/usr/bin/should-not-be-used');
    const exists = vi.fn((p: string) => p === bundled);

    const result = resolveAgentBinary(engine, { bundledDir: BUNDLED_DIR, which, exists });

    expect(result).toEqual({ path: bundled, source: 'bundled' });
    expect(exists).toHaveBeenCalledWith(bundled);
    expect(which).not.toHaveBeenCalled();
  });

  it('claude: no bundled file, the CLI on PATH is used', () => {
    const onPath = path.join('C:', 'Users', 'someone', '.local', 'bin', 'claude.exe');
    const which = vi.fn((cmd: string) => (cmd === 'claude' ? onPath : null));

    const result = resolveAgentBinary('claude', {
      bundledDir: BUNDLED_DIR,
      which,
      exists: () => false,
    });

    expect(result).toEqual({ path: onPath, source: 'path' });
    expect(which).toHaveBeenCalledWith('claude');
  });

  it.each([
    ['codex', 'codex'],
    ['rg', 'rg'],
    ['pi', 'pi'],
  ] as const)('%s: PATH lookup asks for the %s command', (engine, command) => {
    const which = vi.fn((cmd: string) => (cmd === command ? `/opt/bin/${cmd}` : null));

    const result = resolveAgentBinary(engine, {
      bundledDir: BUNDLED_DIR,
      which,
      exists: () => false,
    });

    expect(result).toEqual({ path: `/opt/bin/${command}`, source: 'path' });
  });

  it('claude: neither bundled nor on PATH gives an install message naming Claude Code', () => {
    const result = resolveAgentBinary('claude', {
      bundledDir: BUNDLED_DIR,
      which: () => null,
      exists: () => false,
    });

    expect(result).not.toHaveProperty('path');
    expect('error' in result && result.error).toMatch(/Claude Code/);
    expect('error' in result && result.error).toMatch(/install/i);
  });

  it('codex: neither bundled nor on PATH gives an install message naming Codex CLI', () => {
    const result = resolveAgentBinary('codex', {
      bundledDir: BUNDLED_DIR,
      which: () => null,
      exists: () => false,
    });

    expect(result).not.toHaveProperty('path');
    expect('error' in result && result.error).toMatch(/Codex CLI/);
    expect('error' in result && result.error).toMatch(/install/i);
  });

  it.each([
    ['rg', /ripgrep/],
    ['pi', /\bpi\b/],
  ] as const)(
    '%s: neither bundled nor on PATH names the engine and says to install it',
    (engine, name) => {
      const result = resolveAgentBinary(engine, {
        bundledDir: BUNDLED_DIR,
        which: () => null,
        exists: () => false,
      });

      expect(result).not.toHaveProperty('path');
      expect('error' in result && result.error).toMatch(name);
      expect('error' in result && result.error).toMatch(/install/i);
    },
  );

  it('never makes a network request: only the injected deps are used, for all four engines', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const results = ENGINES.map((engine) =>
      resolveAgentBinary(engine, {
        bundledDir: BUNDLED_DIR,
        which: () => null,
        exists: () => false,
      }),
    );

    for (const result of results) {
      expect(Object.keys(result)).toEqual(['error']);
      expect((result as { error: string }).error.length).toBeGreaterThan(0);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
