/**
 * Countersign (final review M-F5): Codex model discovery under the real
 * LOCAL_ONLY, with the real app session and the real native-provider binding.
 *
 * Under LOCAL_ONLY the app session is always 'local' with the reserved owner
 * local-v1. A Codex sign-in made in the app binds 'openai' to that owner, and
 * discovery then reads the app's own Codex model cache. Without that binding
 * the cache is not read. The upstream mapper tests in codexModelDiscovery.test.ts
 * stub the binding check instead.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

const state = vi.hoisted(() => ({ userData: '' }));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'userData' ? state.userData : os.tmpdir()),
  },
}));

import { getActiveAppSession, LOCAL_DATA_OWNER_ID } from '../../appSessionState.js';
import { readCodexDiscoveredModels } from '../codex-model-discovery.js';
import { bindNativeProviderAuth } from '../nativeProviderAuthBinding.js';

const MODELS_CACHE = {
  models: [
    {
      slug: 'gpt-local-test',
      display_name: 'GPT Local Test',
      visibility: 'list',
      supported_in_api: true,
      context_window: 272000,
      default_reasoning_level: 'medium',
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }],
    },
  ],
};

function writeCodexHome(): void {
  const codexHome = path.join(state.userData, 'codex-home');
  fs.mkdirSync(codexHome, { recursive: true });
  const accessToken = ['test', 'access', 'token'].join('-');
  fs.writeFileSync(
    path.join(codexHome, 'auth.json'),
    JSON.stringify({ tokens: { access_token: accessToken } }),
  );
  fs.writeFileSync(path.join(codexHome, 'models_cache.json'), JSON.stringify(MODELS_CACHE));
}

function readBindingFile(): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(state.userData, 'native-provider-auth.json'), 'utf8'),
  ) as Record<string, unknown>;
}

beforeEach(() => {
  state.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-codex-discovery-'));
});

afterEach(() => {
  fs.rmSync(state.userData, { recursive: true, force: true });
});

describe('Codex model discovery under LOCAL_ONLY', () => {
  it('reads the cache of a Codex sign-in bound to local-v1', async () => {
    expect(LOCAL_ONLY).toBe(true);
    expect(LOCAL_DATA_OWNER_ID).toBe('local-v1');
    expect(getActiveAppSession()).toMatchObject({ mode: 'local', dataOwnerId: 'local-v1' });

    writeCodexHome();
    // The call the in-app Codex sign-in makes once its token is written.
    bindNativeProviderAuth('openai', { instanceIsolated: false });
    expect(readBindingFile()).toMatchObject({ openai: 'local-v1' });

    const models = await readCodexDiscoveredModels();
    expect(models?.map((model) => model.id)).toEqual(['gpt-local-test']);
  });

  it('does not read the cache when no sign-in is bound to local-v1', async () => {
    writeCodexHome();
    await expect(readCodexDiscoveredModels()).resolves.toEqual([]);

    fs.writeFileSync(
      path.join(state.userData, 'native-provider-auth.json'),
      JSON.stringify({ openai: 'another-owner' }),
    );
    await expect(readCodexDiscoveredModels()).resolves.toEqual([]);
  });
});
