/**
 * Countersign: the endpoint manifest is never fetched and every endpoint
 * getter fails closed with LocalOnlyError.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcOn = vi.hoisted(() => vi.fn());
const netRequest = vi.hoisted(() => vi.fn(() => {
  throw new Error('net.request must not be called');
}));
const showMessageBoxSync = vi.hoisted(() => vi.fn());
const appExit = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/countersign-user-data'),
    getAppPath: vi.fn(() => '/repo/apps/desktop'),
    getPreferredSystemLanguages: vi.fn(() => ['en-US']),
    isPackaged: true,
    exit: appExit,
  },
  dialog: { showMessageBoxSync },
  clipboard: { writeText: vi.fn() },
  ipcMain: { on: ipcOn },
  net: { request: netRequest, fetch: netRequest },
  netLog: { startLogging: vi.fn(async () => {}), stopLogging: vi.fn(async () => {}) },
  session: { defaultSession: { resolveProxy: vi.fn(async () => 'DIRECT') } },
}));

vi.mock('../logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  getLogDir: () => '/tmp/countersign-test-logs',
}));

import { CLIENT_ENDPOINT_KEYS } from '@cindy/maker-shared/client-endpoints';
import { LOCAL_ONLY, LocalOnlyError } from '@cindy/maker-shared/local-only';

import {
  CLIENT_ENDPOINTS_SYNC_CHANNEL,
  getBuildClientEndpoint,
  getClientEndpoint,
  getClientEndpointForRealm,
  getResolvedClientEndpoints,
  initClientEndpoints,
  loadClientEndpointsForRealm,
  registerClientEndpointsIpc,
  resetClientEndpointsForTest,
  resolveEndpointSource,
} from '../clientEndpointsService';

const fetchStub = vi.fn(async () => {
  throw new Error('offline');
});

beforeEach(() => {
  fetchStub.mockClear();
  vi.stubGlobal('fetch', fetchStub);
  resetClientEndpointsForTest();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Countersign endpoints fail closed', () => {
  it('is local-only', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('resolves the manifest source as disabled, packaged or not', () => {
    expect(resolveEndpointSource({ isPackaged: true, env: {}, repoRoot: '/repo' })).toEqual({ kind: 'disabled' });
    expect(resolveEndpointSource({ isPackaged: false, env: {}, repoRoot: '/repo' })).toEqual({ kind: 'disabled' });
    expect(
      resolveEndpointSource({ isPackaged: false, env: { XDT_ENDPOINTS_CDN: '1' }, repoRoot: '/repo' }),
    ).toEqual({ kind: 'disabled' });
  });

  it('starts offline: no fetch, no retry dialog, no exit', async () => {
    await expect(initClientEndpoints()).resolves.toBe(true);
    expect(fetchStub).toHaveBeenCalledTimes(0);
    expect(netRequest).toHaveBeenCalledTimes(0);
    expect(showMessageBoxSync).not.toHaveBeenCalled();
    expect(appExit).not.toHaveBeenCalled();
  });

  it('getClientEndpoint throws LocalOnlyError for the plugin market', async () => {
    await initClientEndpoints();
    let caught: unknown;
    try {
      getClientEndpoint('pluginApiBaseUrl');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LocalOnlyError);
    expect((caught as Error).message).toContain('not available in Countersign');
    expect((caught as Error).message).toContain('Plugin market');
  });

  it('every key throws LocalOnlyError from every getter', async () => {
    await initClientEndpoints();
    for (const key of CLIENT_ENDPOINT_KEYS) {
      expect(() => getClientEndpoint(key)).toThrow(LocalOnlyError);
      expect(() => getBuildClientEndpoint(key)).toThrow(LocalOnlyError);
      expect(() => getClientEndpointForRealm('global', key)).toThrow(LocalOnlyError);
    }
    expect(() => getResolvedClientEndpoints()).toThrow(LocalOnlyError);
  });

  it('a test-injected manifest does not reopen the getters', () => {
    const injected = Object.fromEntries(CLIENT_ENDPOINT_KEYS.map((key) => [key, 'https://x.test.invalid'])) as never;
    resetClientEndpointsForTest(injected);
    expect(() => getClientEndpoint('modelAccessApiBaseUrl')).toThrow(LocalOnlyError);
  });

  it('realm manifests are never fetched', async () => {
    await expect(loadClientEndpointsForRealm('cn')).rejects.toBeInstanceOf(LocalOnlyError);
    expect(fetchStub).toHaveBeenCalledTimes(0);
    expect(netRequest).toHaveBeenCalledTimes(0);
  });

  it('optional callers get null instead of a throw', async () => {
    const { tryGetClientEndpoint } = await import('../countersign/optionalEndpoint');
    expect(tryGetClientEndpoint('chatApiBaseUrl')).toBeNull();
    expect(tryGetClientEndpoint('modelAccessApiBaseUrl')).toBeNull();
  });

  it('the renderer sync channel gets an empty website URL instead of an error', () => {
    registerClientEndpointsIpc();
    const [channel, handler] = ipcOn.mock.calls.at(-1) as [string, (event: { returnValue?: unknown }) => void];
    expect(channel).toBe(CLIENT_ENDPOINTS_SYNC_CHANNEL);
    const event: { returnValue?: unknown } = {};
    handler(event);
    expect(event.returnValue).toEqual({ websiteUrl: '' });
  });
});

describe('Countersign CDN base URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ignores XDT_CDN_BASE_URL: getBaseUrl throws LocalOnlyError and fetchManifest sends nothing', async () => {
    vi.stubEnv('XDT_CDN_BASE_URL', 'https://cdn.example.invalid');
    await initClientEndpoints();
    const { fetchManifest, getBaseUrl } = await import('../manifestService');

    expect(() => getBaseUrl()).toThrow(LocalOnlyError);
    await expect(fetchManifest(100)).rejects.toBeInstanceOf(LocalOnlyError);
    expect(netRequest).toHaveBeenCalledTimes(0);
    expect(fetchStub).toHaveBeenCalledTimes(0);
  });
});
