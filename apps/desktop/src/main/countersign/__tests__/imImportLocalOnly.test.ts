/**
 * Countersign: chat-app bots (IM) are "Later" in the design. Under LOCAL_ONLY
 * a teammate import that carries IM credentials must not create a connection,
 * and neither may the IM add handler. The real services switch is used here
 * (LOCAL_ONLY is true in this build); only storage, the database and Electron
 * are stand-ins.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  root: '',
  ipcHandlers: new Map<string, (event: unknown, payload: unknown) => unknown>(),
  secrets: new Map<string, string>(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => h.root },
  ipcMain: {
    handle: vi.fn((name: string, handler: (event: unknown, payload: unknown) => unknown) =>
      h.ipcHandlers.set(name, handler),
    ),
  },
  BrowserWindow: { getAllWindows: () => [] },
}));
vi.mock('../../logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../../maker-host/logger-adapter.js', () => ({
  desktopMakerLogger: { child: () => ({ info: vi.fn(), warn: vi.fn() }) },
}));
vi.mock('../../appSessionState.js', () => ({
  activeOwnerScopeKey: () => 'owner-a',
  isAppSessionBoundaryPending: () => false,
}));
vi.mock('../../im/ownerScopedStorage.js', () => ({
  ownerScopedImUserDataPath: (...parts: string[]) =>
    path.join(h.root, 'owners', 'owner-a', ...parts),
  ownerScopedImSecrets: {
    isAvailable: () => true,
    read: (name: string) => h.secrets.get(name) ?? null,
    readResult: (name: string) =>
      h.secrets.has(name) ? { kind: 'value', value: h.secrets.get(name) } : { kind: 'missing' },
    write: (name: string, value: string) => {
      h.secrets.set(name, value);
      return true;
    },
    remove: (name: string) => {
      h.secrets.delete(name);
    },
  },
}));
vi.mock('../../localDb/client/current', () => ({
  getDbClient: () => ({
    drizzle: {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [{ status: 'active' }] }) }),
      }),
    },
  }),
}));
vi.mock('../../localDb/schema', () => ({ botProfiles: { id: 'id', status: 'status' } }));
vi.mock('drizzle-orm', () => ({ eq: () => ({}) }));
vi.mock('../../localDb/ipc/bots', () => ({ archiveBotChannelLanes: vi.fn(async () => []) }));
vi.mock('../../security/trustedAppRenderer', () => ({ assertTrustedAppRendererEvent: vi.fn() }));

import { connectImportedImBot, importedImBotTarget } from '../../bot-import/imBotConnections';
import {
  addBotImConnection,
  configureBotImConnectionRuntime,
  registerBotImConnectionIpc,
} from '../../im/shared/botImConnectionRuntime';
import { listBotImConnections } from '../../im/shared/botImConnectionStore';
import { isServiceDisabled } from '../services';

// A Telegram-shaped bot token, built from parts so no credential-shaped literal is committed.
const TOKEN = ['123456', 'A'.repeat(30)].join(':');
const OWNER = '4242';
const create = vi.fn();

beforeEach(() => {
  h.root = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-im-import-'));
  h.secrets.clear();
  create.mockReset();
  configureBotImConnectionRuntime({
    removeWechatCompanionBinding: async () => undefined,
    create,
    settingsIdentity: () => ({}),
    listKnownGroups: async () => [],
  } as never);
});

afterEach(() => {
  fs.rmSync(h.root, { recursive: true, force: true });
});

describe('IM connections under LOCAL_ONLY', () => {
  it('runs with the IM connectors switched off', () => {
    expect(isServiceDisabled('imConnectors')).toBe(true);
  });

  it('an import that carries Telegram credentials does not connect', async () => {
    const issue = await connectImportedImBot('bot-1', {
      format: 'telegram',
      value: { token: TOKEN, ownerUserId: OWNER },
    });
    expect(issue).toBe('IMPORT_IM_BOT_CONNECT_FAILED');
    expect(create).not.toHaveBeenCalled();
    expect(listBotImConnections()).toEqual([]);
    expect([...h.secrets.keys()]).toEqual([]);
  });

  it('a takeover stops at preflight, before the source bot is touched', async () => {
    const target = importedImBotTarget('bot-1', {
      format: 'telegram',
      value: { token: TOKEN, ownerUserId: OWNER },
    });
    expect(typeof target).toBe('object');
    if (typeof target === 'string') return;
    await expect(target.preflight()).resolves.toBe('IMPORT_IM_BOT_CONNECT_FAILED');
    await expect(target.connect()).resolves.toBe('IMPORT_IM_BOT_CONNECT_FAILED');
    expect(create).not.toHaveBeenCalled();
  });

  it('addBotImConnection refuses with a neutral message', async () => {
    const refusal = addBotImConnection({
      botId: 'bot-1',
      channel: 'telegram',
      token: TOKEN,
      ownerUserId: OWNER,
    });
    await expect(refusal).rejects.toThrow(/IM_CONNECTORS_DISABLED/);
    await expect(refusal).rejects.not.toThrow(/Cindy/);
    expect(create).not.toHaveBeenCalled();
    expect(listBotImConnections()).toEqual([]);
  });

  it('the add IPC handler refuses', async () => {
    registerBotImConnectionIpc();
    const handler = h.ipcHandlers.get('botImConnection:add');
    expect(handler).toBeTypeOf('function');
    await expect(
      Promise.resolve(
        handler?.({}, { botId: 'bot-1', channel: 'telegram', token: TOKEN, ownerUserId: OWNER }),
      ),
    ).rejects.toThrow(/IM_CONNECTORS_DISABLED/);
    expect(create).not.toHaveBeenCalled();
  });
});
