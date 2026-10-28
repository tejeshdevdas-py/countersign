/**
 * Countersign: under LOCAL_ONLY a Pi core update (`pi update --self`, or
 * `--all`, which updates the extensions first) is refused before any step: no
 * Pi process starts, the package lock is not taken and the Host installer is
 * not called, so nothing is half done. The parser refuses the same commands
 * with the user-facing message; this is the executor's own check for any
 * caller that reaches it directly. LOCAL_ONLY is the real value here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  spawn: vi.fn(),
  updateReadyPiBinary: vi.fn(),
  lock: vi.fn(),
}));

vi.mock('electron', () => ({ app: { getPath: () => '/mock/user-data' } }));
vi.mock('../../agent-binaries/index.js', () => ({
  getReadyBinaryPath: () => '/mock/pi',
  updateReadyPiBinary: h.updateReadyPiBinary,
}));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child() {
      return this;
    },
  }),
}));
vi.mock('../../device-link/crossProcessLock.js', () => ({ withSecurityBoundaryLock: h.lock }));
vi.mock('../../scheduler-host/proc-util.js', () => ({ killProcessTree: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: h.spawn }));

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import {
  executePiNativeManagementCommand,
  piNativeManagementFailure,
  piPackageMutationMayHaveChangedState,
} from '../../maker-host/pi-package-store.js';

beforeEach(() => {
  h.spawn.mockReset();
  h.updateReadyPiBinary.mockReset();
  h.lock.mockReset();
});

describe('Pi core update commands under LOCAL_ONLY', () => {
  it('runs with LOCAL_ONLY on', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it.each([
    { kind: 'all', force: false },
    { kind: 'all', force: true },
    { kind: 'self', force: false },
    { kind: 'self', force: true },
  ] as const)('refuses $kind (force $force) before any step', async (command) => {
    const error = await executePiNativeManagementCommand(command).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/^PI_UPDATES_DISABLED: /);
    expect(h.spawn).not.toHaveBeenCalled();
    expect(h.lock).not.toHaveBeenCalled();
    expect(h.updateReadyPiBinary).not.toHaveBeenCalled();
    expect(piPackageMutationMayHaveChangedState(error)).toBe(false);
    expect(piNativeManagementFailure(error)).toBeUndefined();
  });
});
