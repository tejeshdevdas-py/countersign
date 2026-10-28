import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const persisted = vi.hoisted(() => ({ activeMode: 'signed-out' as string }));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => `C:/tmp/countersign-${name}`,
    getName: () => 'Countersign',
    getVersion: () => '0.0.0',
    isPackaged: false,
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
  },
  BrowserWindow: { getAllWindows: () => [] },
  net: { fetch: vi.fn() },
  safeStorage: { isEncryptionAvailable: () => false },
  shell: { openExternal: vi.fn() },
  powerMonitor: { on: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

vi.mock('../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../maker-host/override-settings-file.js', () => ({
  createOverrideSettingsFile: () => ({
    read: () => ({ activeMode: persisted.activeMode }),
    writePatch: (patch: { activeMode?: string }) => {
      if (patch.activeMode) persisted.activeMode = patch.activeMode;
    },
  }),
}));

import { LOCAL_ONLY, LocalOnlyError } from '@cindy/maker-shared';
import { getActiveAppSession } from '../appSessionState.js';

describe('Countersign local-only constants', () => {
  it('is local-only and the error is identifiable', () => {
    expect(LOCAL_ONLY).toBe(true);
    const error = new LocalOnlyError('Sign-in');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LocalOnlyError');
    expect(error.message).toBe(
      'Sign-in is not available in Countersign: it needs a cloud service that this local-only app does not use.',
    );
  });
});

/** appSessionState caches the session it loaded, so each case reads the persisted mode afresh. */
async function loadAppSessionState(): Promise<typeof import('../appSessionState.js')> {
  // reset-modules: appSessionState caches the loaded session; each case reads the persisted mode afresh.
  vi.resetModules();
  return import('../appSessionState.js');
}

/** authManager holds login state in module scope, so each case loads it afresh. */
async function loadAuthManager(): Promise<typeof import('../authManager.js')> {
  // reset-modules: authManager holds login state in module scope; each case starts from a fresh load.
  vi.resetModules();
  return import('../authManager.js');
}

describe('Countersign always starts in local mode', () => {
  it('fresh profile starts local', async () => {
    persisted.activeMode = 'signed-out';
    const { getActiveAppSession: get } = await loadAppSessionState();
    expect(get().mode).toBe('local');
    expect(get().dataOwnerId).not.toBeNull();
  });

  it('a persisted cloud mode is ignored', async () => {
    persisted.activeMode = 'cloud';
    const { getActiveAppSession: get } = await loadAppSessionState();
    expect(get().mode).toBe('local');
  });

  it('imports the statically-bound session getter', () => {
    expect(typeof getActiveAppSession).toBe('function');
  });
});

describe('authManager makes no cloud call', () => {
  const fetchStub = vi.fn();

  beforeEach(() => {
    persisted.activeMode = 'signed-out';
    fetchStub.mockReset();
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cloud sign-in entry points reject with LocalOnlyError', async () => {
    const auth = await loadAuthManager();
    await expect(auth.dispatchLoginAction({ type: 'noop' })).rejects.toMatchObject({
      name: 'LocalOnlyError',
    });
    await expect(auth.getLoginState()).rejects.toMatchObject({ name: 'LocalOnlyError' });
    await expect(auth.beginAddAccountLogin()).rejects.toMatchObject({ name: 'LocalOnlyError' });
    await expect(auth.switchSavedAccount('x')).rejects.toMatchObject({ name: 'LocalOnlyError' });
    await expect(auth.exitLocalMode()).rejects.toMatchObject({ name: 'LocalOnlyError' });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('syncSavedAccounts() returns the saved list without any network call', async () => {
    const auth = await loadAuthManager();
    const synced = await auth.syncSavedAccounts();
    expect(synced).toEqual(auth.listSavedAccounts());
    expect(Array.isArray(synced.accounts)).toBe(true);
    expect(await auth.getAccountDeletionStatus()).toBeNull();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('initialize() performs no fetch', async () => {
    const auth = await loadAuthManager();
    auth.setProjectionRepairTeardown(async () => undefined);
    await auth.initialize();
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
