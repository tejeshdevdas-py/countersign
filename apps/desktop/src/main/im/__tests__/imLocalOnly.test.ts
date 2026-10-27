import { beforeEach, describe, expect, it, vi } from 'vitest';

// Countersign: chat-app bots come later and their hosts are not on the egress
// allow-list. Under LOCAL_ONLY (real flag, real services module) the IM start
// entry neither backfills routes nor connects any channel.
const h = vi.hoisted(() => ({
  events: [] as string[],
  started: false,
  relaunching: false,
  db: { owner: 'fake-startup-owner' },
  config: { agentKind: 'claude-code', defaultModel: 'test-model' },
  finishBackfill: (() => undefined) as () => void,
  backfill: vi.fn(),
}));

vi.mock('../../localDb/client/current', () => ({ getDbClient: () => h.db }));
vi.mock('../../maker-ipc/sessionRuntimeControl.js', () => ({}));
vi.mock('../host', () => ({}));
vi.mock('../feishu', () => ({}));
vi.mock('../discord', () => ({}));
vi.mock('../telegram', () => ({}));
vi.mock('../dingtalk', () => ({}));
vi.mock('../wechat', () => ({}));
vi.mock('../wecom', () => ({}));
vi.mock('../telegram/groupWindow', () => ({}));
vi.mock('../shared/orchestrator', () => ({
  getImOrchestrator: (source: string) => source === 'feishu' ? { adapter: { config: h.config } } : undefined,
}));
vi.mock('../shared/channelDefaultRouteSync', () => ({
  backfillLegacyImDefaultRoutesAtStartup: h.backfill,
}));
vi.mock('../connectionLifecycle', () => ({
  createSerializedConnectionLifecycle: () => ({
    isStarted: () => h.started,
    start: () => { h.events.push('connect'); h.started = true; },
  }),
}));
vi.mock('../accountBoundary', () => ({ captureImAccountGeneration: vi.fn() }));
vi.mock('../accountScopeBridge', () => ({ configureImAccountScope: vi.fn() }));
vi.mock('../binding', () => ({}));
vi.mock('../../authManager', () => ({}));
vi.mock('../../updateService', () => ({
  isUpdateRelaunchImminent: () => h.relaunching,
  getUpdateStatus: () => 'ready',
}));
vi.mock('../../logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../security/trustedAppRenderer', () => ({}));
vi.mock('../wechat/channelSettings', () => ({}));
// Countersign: these upstream cases run with IM allowed; imLocalOnly.test.ts covers LOCAL_ONLY.

import { startImConnection } from '../index';
import { isServiceDisabled } from '../../countersign/services';

beforeEach(() => {
  h.events.length = 0;
  h.started = false;
  h.relaunching = false;
  h.backfill.mockReset().mockImplementation(() => {
    h.events.push('backfill');
    return Promise.resolve();
  });
});

describe('IM start under LOCAL_ONLY', () => {
  it('marks the IM connectors as a disabled service', () => {
    expect(isServiceDisabled('imConnectors')).toBe(true);
  });

  it('skips the start: no route backfill and no channel connects', () => {
    startImConnection();
    startImConnection();
    expect(h.events).toEqual([]);
    expect(h.backfill).not.toHaveBeenCalled();
  });
});
