import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  fetchManifest: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      h.handlers.set(channel, handler);
    }),
  },
}));
vi.mock('node:child_process', () => ({ execFile: h.execFile }));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../pi-kernel.js', () => ({ registerPiKernelIpc: vi.fn() }));
vi.mock('../../security/trustedAppRenderer.js', () => ({ assertTrustedAppRendererEvent: vi.fn() }));
vi.mock('../../device-link/invoke-context.js', () => ({ isDeviceLinkInvoke: () => false }));
vi.mock('../../manifestService.js', () => ({
  fetchManifest: h.fetchManifest,
  getPlatformKey: () => 'darwin-arm64',
}));
vi.mock('../../agent-binaries/index.js', () => ({
  getReadyBinaryPath: (kind: string) => `/managed/${kind}`,
  getCachedBinaryStatus: () => ({ binaryReady: false, binaryPath: null }),
  isVettedAgentBinaryPath: () => true,
}));

const { registerMakerBinaryVersionIpc } = await import('../binary-version.js');
const { MAKER_INVOKE } = await import('../channels.js');

describe('maker:agent:binary-version in Countersign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.handlers.clear();
    h.execFile.mockImplementation(
      (_p: string, _a: string[], _o: unknown, cb: (e: Error | null, out: string, err: string) => void) =>
        cb(null, '1.2.3\n', ''),
    );
    registerMakerBinaryVersionIpc();
  });

  it('checkLatest never fetches the manifest and does not report a failure', async () => {
    const handler = h.handlers.get(MAKER_INVOKE.AGENT_BINARY_VERSION)!;
    const res = (await handler({}, 'claude-code', { checkLatest: true })) as {
      version: string | null;
      latestVersion: string | null;
      updateAvailable: boolean;
      latestCheckFailed: boolean;
    };
    expect(h.fetchManifest).not.toHaveBeenCalled();
    expect(res.latestVersion).toBeNull();
    expect(res.updateAvailable).toBe(false);
    expect(res.latestCheckFailed).toBe(false);
    expect(res.version).toBe('1.2.3');
  });
});
