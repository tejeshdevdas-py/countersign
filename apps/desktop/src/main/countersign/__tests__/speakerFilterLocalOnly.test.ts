/**
 * Countersign: the "Recognize my voice" speaker filter downloads its models
 * only from the upstream project's CDN, which local mode never contacts. Under
 * LOCAL_ONLY the model download handler refuses before the model store is
 * asked to download; the status read still answers.
 * LOCAL_ONLY is the real value here (true in this build).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  userData: '',
}));

vi.mock('electron', () => ({
  app: { getPath: () => h.userData, once: vi.fn() },
  ipcMain: {
    handle: vi.fn((name: string, handler: (event: unknown, ...args: unknown[]) => unknown) =>
      h.handlers.set(name, handler),
    ),
  },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: { isEncryptionAvailable: () => false },
}));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../../appSessionState.js', () => ({
  ownerScopedUserDataPath: (...parts: string[]) => path.join(h.userData, 'owner', ...parts),
  activeOwnerScopeKey: () => 'owner:1',
  getActiveAppSession: () => ({ dataOwnerId: 'owner' }),
  isAppSessionBoundaryPending: () => false,
}));
vi.mock('../../clientEndpointsService.js', () => ({
  // Under LOCAL_ONLY the endpoint service refuses every upstream endpoint.
  getClientEndpoint: () => {
    throw new Error('endpoint unavailable in local mode');
  },
}));
vi.mock('../../security/trustedAppRenderer.js', () => ({
  assertTrustedAppRendererEvent: vi.fn(),
  isTrustedAppRendererWindow: () => true,
}));

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import { VOICE_SPEAKER_FILTER_CHANNELS } from '../../../shared/voiceSpeakerFilter';
import { registerVoiceSpeakerFilterIpc } from '../../voice-input/speaker/index.js';
import { SpeakerModelStore } from '../../voice-input/speaker/speakerModelStore.js';

function handler(channel: string) {
  const found = h.handlers.get(channel);
  if (!found) throw new Error(`no handler for ${channel}`);
  return found;
}

beforeAll(() => {
  h.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-speaker-'));
  registerVoiceSpeakerFilterIpc();
});

afterAll(() => {
  fs.rmSync(h.userData, { recursive: true, force: true });
});

describe('speaker filter IPC under LOCAL_ONLY', () => {
  it('runs with LOCAL_ONLY on', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('refuses the model download before the store is asked to download', () => {
    const ensureDownloaded = vi.spyOn(SpeakerModelStore.prototype, 'ensureDownloaded');
    let refusal: unknown = null;
    try {
      handler(VOICE_SPEAKER_FILTER_CHANNELS.downloadModels)({});
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: expect.stringContaining('SPEAKER_FILTER_DISABLED'),
    });
    expect(ensureDownloaded).not.toHaveBeenCalled();
  });

  it('still answers the status read', () => {
    const status = handler(VOICE_SPEAKER_FILTER_CHANNELS.getStatus)({}) as { enrolled: boolean };
    expect(status.enrolled).toBe(false);
  });
});
