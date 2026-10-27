import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const provisioner = {
    prepare: vi.fn(),
    peekNeedsDownload: vi.fn(),
    getState: vi.fn(async () => ({ status: 'not_installed' })),
    cleanup: vi.fn(),
  };
  return {
    appMock: {
      isPackaged: true,
      getPath: vi.fn(() => ''),
      getAppPath: vi.fn(() => ''),
      getVersion: () => '1.0.0',
    },
    provisioner,
    createBinaryProvisioner: vi.fn(() => provisioner),
    findDevBinary: vi.fn((): string | null => null),
    fetchManifest: vi.fn(async (): Promise<unknown> => null),
    getCachedManifest: vi.fn((): unknown => null),
    whichOnPath: vi.fn<(cmd: string) => string | null>(() => null),
  };
});

vi.mock('electron', () => ({
  app: h.appMock,
  BrowserWindow: { getAllWindows: () => [] },
}));
vi.mock('../../agent-binaries/factory.js', () => ({
  createBinaryProvisioner: h.createBinaryProvisioner,
}));
vi.mock('../../agent-binaries/dev-fallback.js', () => ({ findDevBinary: h.findDevBinary }));
vi.mock('../../manifestService.js', () => ({
  getPlatformKey: () => `${process.platform}-${process.arch}`,
  getCachedManifest: h.getCachedManifest,
  fetchManifest: h.fetchManifest,
}));
vi.mock('../cliResolver.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cliResolver.js')>()),
  whichOnPath: h.whichOnPath,
}));

const exe = (base: string): string => (process.platform === 'win32' ? `${base}.exe` : base);
const tmpRoots: string[] = [];
let binaries: typeof import('../../agent-binaries/index');

function makeResources(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-agent-bin-'));
  tmpRoots.push(root);
  return root;
}

function placeBundled(resources: string, relative: string): string {
  const file = path.join(resources, 'agent-bin', relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  return file;
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  h.appMock.isPackaged = true;
  h.findDevBinary.mockReturnValue(null);
  h.whichOnPath.mockReturnValue(null);
  Object.defineProperty(process, 'resourcesPath', { value: makeResources(), configurable: true });
  binaries = await import('../../agent-binaries/index');
});

afterAll(() => {
  for (const root of tmpRoots) fs.rmSync(root, { recursive: true, force: true });
});

describe('agent binaries under LOCAL_ONLY', () => {
  it('packaged: prepare uses the bundled binaries and never touches the manifest or the CDN provisioner', async () => {
    const claude = placeBundled(process.resourcesPath, path.join('claude-code', exe('claude')));
    const codex = placeBundled(
      process.resourcesPath,
      path.join('codex-package', 'bin', exe('codex')),
    );
    const pi = placeBundled(process.resourcesPath, path.join('pi', exe('pi')));

    await expect(binaries.prepare('claude-code')).resolves.toEqual({
      ready: true,
      path: claude,
      downloaded: false,
    });
    await expect(binaries.prepare('codex')).resolves.toEqual({
      ready: true,
      path: codex,
      downloaded: false,
    });
    await expect(binaries.prepare('pi')).resolves.toEqual({
      ready: true,
      path: pi,
      downloaded: false,
    });

    expect(h.whichOnPath).not.toHaveBeenCalled();
    expect(h.fetchManifest).not.toHaveBeenCalled();
    expect(h.provisioner.prepare).not.toHaveBeenCalled();
    expect(binaries.getReadyBinaryPath('codex')).toBe(codex);
  });

  it("packaged: falls back to the CLI on PATH (the user's own login)", async () => {
    const onPath = path.join(makeResources(), exe('claude'));
    h.whichOnPath.mockImplementation((cmd) => (cmd === 'claude' ? onPath : null));

    await expect(binaries.prepare('claude-code')).resolves.toEqual({
      ready: true,
      path: onPath,
      downloaded: false,
    });
    expect(h.fetchManifest).not.toHaveBeenCalled();
  });

  it('packaged: neither bundled nor on PATH returns the install message, with no download', async () => {
    const result = await binaries.prepare('codex');

    expect(result.ready).toBe(false);
    expect(result.error).toMatch(/Codex CLI/);
    expect(result.downloaded).toBe(false);
    expect(h.fetchManifest).not.toHaveBeenCalled();
    expect(h.provisioner.prepare).not.toHaveBeenCalled();
  });

  it('dev: a missing apps/*-bin binary gives the resolver error, not a download', async () => {
    h.appMock.isPackaged = false;
    h.appMock.getAppPath.mockReturnValue(path.join(makeResources(), 'apps', 'desktop'));

    const result = await binaries.prepare('pi');

    expect(result.ready).toBe(false);
    expect(result.error).toMatch(/\bpi\b/);
    expect(h.fetchManifest).not.toHaveBeenCalled();
    expect(h.provisioner.prepare).not.toHaveBeenCalled();
  });

  it('dev: the apps/*-bin binary is used', async () => {
    h.appMock.isPackaged = false;
    const devPath = path.join('apps', 'claude-code-bin', 'x', exe('claude'));
    h.findDevBinary.mockReturnValue(devPath);

    await expect(binaries.prepare('claude-code')).resolves.toEqual({
      ready: true,
      path: devPath,
      downloaded: false,
    });
    expect(h.whichOnPath).not.toHaveBeenCalled();
  });

  it('peekNeedsDownload is false and makes no manifest request', async () => {
    for (const kind of ['claude-code', 'codex', 'pi'] as const) {
      await expect(binaries.peekNeedsDownload(kind)).resolves.toBe(false);
    }
    expect(h.fetchManifest).not.toHaveBeenCalled();
    expect(h.provisioner.peekNeedsDownload).not.toHaveBeenCalled();
  });

  it('isVettedAgentBinaryPath accepts exactly the resolved path and nothing else', async () => {
    const codex = placeBundled(
      process.resourcesPath,
      path.join('codex-package', 'bin', exe('codex')),
    );
    expect(binaries.isVettedAgentBinaryPath('codex', codex)).toBe(false);

    await binaries.prepare('codex');

    expect(binaries.isVettedAgentBinaryPath('codex', codex)).toBe(true);
    expect(binaries.isVettedAgentBinaryPath('codex', `${codex} `)).toBe(false);
    expect(binaries.isVettedAgentBinaryPath('codex', path.dirname(codex))).toBe(false);
    expect(binaries.isVettedAgentBinaryPath('claude-code', codex)).toBe(false);
    expect(binaries.isVettedAgentBinaryPath('codex', '')).toBe(false);
  });

  it('getCachedBinaryStatus reports the bundled binary without a PATH lookup or userData scan', () => {
    expect(binaries.getCachedBinaryStatus('pi')).toEqual({ binaryReady: false });
    const pi = placeBundled(process.resourcesPath, path.join('pi', exe('pi')));

    expect(binaries.getCachedBinaryStatus('pi')).toEqual({ binaryReady: true, binaryPath: pi });
    expect(h.whichOnPath).not.toHaveBeenCalled();
    expect(h.appMock.getPath).not.toHaveBeenCalled();
  });
});
