/**
 * Countersign: Pi ships with the app. Under LOCAL_ONLY the Settings > About
 * handlers report the installed version but refuse the online check (GitHub)
 * and the install of another Pi build; the managed Pi "update" command refuses
 * too. LOCAL_ONLY is the real value here (true in this build).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  manager: { state: vi.fn(), check: vi.fn(), install: vi.fn() },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((name: string, handler: (event: unknown, ...args: unknown[]) => unknown) =>
      h.handlers.set(name, handler),
    ),
  },
}));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../../security/trustedAppRenderer.js', () => ({ assertTrustedAppRendererEvent: vi.fn() }));
vi.mock('../../agent-binaries/index.js', () => ({ getPiKernelManager: () => h.manager }));
vi.mock('../../manifestService.js', () => ({ getBaseUrl: vi.fn(), getPlatformKey: vi.fn() }));

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import { MAKER_INVOKE } from '../../maker-ipc/channels.js';
import { registerPiKernelIpc } from '../../maker-ipc/pi-kernel.js';

function handler(channel: string) {
  const found = h.handlers.get(channel);
  if (!found) throw new Error(`no handler for ${channel}`);
  return found;
}

beforeEach(() => {
  h.handlers.clear();
  h.manager.state.mockReset().mockResolvedValue({ currentVersion: '1.0.2' });
  h.manager.check.mockReset();
  h.manager.install.mockReset();
  registerPiKernelIpc();
});

describe('Pi kernel IPC under LOCAL_ONLY', () => {
  it('runs with LOCAL_ONLY on', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('still reports the installed version', async () => {
    await expect(handler(MAKER_INVOKE.PI_KERNEL_STATE)({}, false)).resolves.toEqual({
      currentVersion: '1.0.2',
    });
    expect(h.manager.check).not.toHaveBeenCalled();
  });

  it('refuses the online check', async () => {
    await expect(handler(MAKER_INVOKE.PI_KERNEL_STATE)({}, true)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: expect.stringContaining('PI_UPDATES_DISABLED'),
    });
    expect(h.manager.check).not.toHaveBeenCalled();
  });

  it('refuses to install another Pi build from either source', async () => {
    for (const source of ['upstream', 'official']) {
      await expect(
        handler(MAKER_INVOKE.PI_KERNEL_INSTALL)({}, { source, version: '9.9.9' }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    }
    expect(h.manager.install).not.toHaveBeenCalled();
  });
});
