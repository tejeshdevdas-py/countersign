// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import {
  companionImportReasonKey,
  type CompanionImportApi,
} from '@cindy/maker-shared/companion-import';
import { BotImportForm } from '../BotImportForm';

// M-J8: under the real LOCAL_ONLY switch an imported chat-app bot is never connected or taken
// over. Its issue has its own text, and the bots group does not promise a takeover.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key} ${Object.values(options).join(' ')}` : key,
  }),
}));
vi.mock('../botStore', () => ({ useBotProfiles: () => [] }));
vi.mock('../BotPortraitPicker', () => ({
  BOT_PORTRAIT_COUNT: 17,
  galleryPortrait: async () => 'data:image/png;base64,portrait',
  BotPortraitPicker: () => null,
}));
afterEach(cleanup);

const LOCALES = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW'];

function locale(name: string): {
  bots: { import: Record<string, string> };
  countersignLocalOnly: Record<string, unknown>;
} {
  const file = resolve(__dirname, '..', '..', '..', 'i18n', 'locales', name, 'common.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}

describe('chat-app bot import under LOCAL_ONLY', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('maps the local-only issue to its own text in every locale', () => {
    expect(companionImportReasonKey('IMPORT_IM_BOT_LOCAL_ONLY')).toBe('imBotLocalOnly');
    for (const name of LOCALES) {
      const json = locale(name);
      expect(typeof json.bots.import.imBotLocalOnly, name).toBe('string');
      expect(json.countersignLocalOnly.importBotsNote, name).toContain('{{source}}');
    }
  });

  it('does not promise a takeover for the bots group', async () => {
    const api: CompanionImportApi = {
      sources: async () => [{ id: 'source', name: 'Ada', kind: 'hermes' }],
      preview: async () => ({
        id: 'preview',
        name: 'Ada',
        source: { id: 'source', name: 'Ada', kind: 'hermes' },
        entries: [{ id: 'telegram', name: 'Telegram', category: 'bots', selected: true }],
      }),
      status: async () => undefined,
      start: vi.fn(),
    };
    render(<BotImportForm api={api} onCreated={() => {}} onBack={() => {}} onBusy={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Ada.*Hermes/ }));
    expect(await screen.findByText('countersignLocalOnly.importBotsNote Hermes')).toBeTruthy();
    expect(screen.queryByText('bots.import.botsNote Hermes')).toBeNull();
  });
});
