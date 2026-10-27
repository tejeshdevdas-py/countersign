/**
 * Countersign: with no bundled rg, runtime-configs falls back to the user's
 * rg on PATH through the cliResolver, and names ripgrep when neither exists.
 */
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  existsSync: vi.fn<(p: string) => boolean>(() => false),
  whichOnPath: vi.fn<(cmd: string) => string | null>(() => null),
}));

vi.mock('electron', () => ({
  app: { getPath: () => '/cs-rg/user-data', getAppPath: () => '/cs-rg/app', isPackaged: false },
}));
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: h.existsSync,
    chmodSync: vi.fn(),
    default: { ...actual, existsSync: h.existsSync, chmodSync: vi.fn() },
  };
});
vi.mock('../../model-access/effectiveEndpoint.js', () => ({
  effectiveXdGatewayBaseUrl: () => 'http://127.0.0.1:0',
}));
vi.mock('../../countersign/cliResolver.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../countersign/cliResolver.js')>()),
  whichOnPath: h.whichOnPath,
}));

beforeEach(() => {
  vi.resetModules();
  h.existsSync.mockReset().mockReturnValue(false);
  h.whichOnPath.mockReset().mockReturnValue(null);
});

describe('runtime-configs ripgrep under LOCAL_ONLY', () => {
  it('uses rg from PATH when none is bundled', async () => {
    const onPath = path.join('/cs-rg', 'tools', process.platform === 'win32' ? 'rg.exe' : 'rg');
    h.whichOnPath.mockImplementation((cmd) => (cmd === 'rg' ? onPath : null));
    const { getRipgrepBinaryPath } = await import('../runtime-configs.js');

    expect(getRipgrepBinaryPath()).toBe(onPath);
    expect(h.whichOnPath).toHaveBeenCalledWith('rg');
  });

  it('throws an install message naming ripgrep when it is neither bundled nor on PATH', async () => {
    const { ensureBundledRipgrepReady } = await import('../runtime-configs.js');

    expect(() => ensureBundledRipgrepReady()).toThrow(/ripgrep.*install/is);
  });

  it('prefers the bundled rg and does not look on PATH', async () => {
    h.existsSync.mockReturnValue(true);
    const { getRipgrepBinaryPath } = await import('../runtime-configs.js');

    expect(path.basename(getRipgrepBinaryPath())).toMatch(/^rg(\.exe)?$/);
    expect(h.whichOnPath).not.toHaveBeenCalled();
  });
});
