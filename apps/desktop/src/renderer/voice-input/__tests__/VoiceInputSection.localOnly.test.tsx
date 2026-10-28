// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { VoiceInputSection } from '../../components/settings/VoiceInputSection';
import { getDefaultVoiceInputSettings } from '../../../shared/voiceInputData';

// M-J1: under the real LOCAL_ONLY switch the voice service hint does not talk about being
// signed out of an account that does not exist.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('@/i18n', () => ({ SUPPORTED_LOCALES: ['en'] }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ mode: 'local' }) }));
vi.mock('@/components/ui/tooltip', () => ({
  Tip: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ warn: vi.fn(), debug: vi.fn() }) }));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/settings/VoiceSpeakerFilterCard', () => ({
  VoiceSpeakerFilterCard: () => null,
}));
vi.mock('@/hooks/useVoiceInputModelSelection', () => ({
  useVoiceInputModelSelection: () => ({
    ready: true,
    asrProfiles: [],
    selection: { serviceMode: 'byok', asrProvider: 'custom-realtime-asr' },
  }),
}));

beforeEach(() => {
  const settings = getDefaultVoiceInputSettings('win32');
  const permissions = { microphone: { ok: true, status: 'granted' } };
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      platform: 'win32',
      voiceInput: {
        getDataSnapshot: () => ({ settings }),
        updateSettings: vi.fn(),
        setGlobalShortcut: vi.fn(async () => ({ ok: true })),
        onDataChanged: () => () => {},
        getHistory: () => [],
        getSystemPermissionsCached: () => permissions,
        getSystemPermissions: async () => permissions,
      },
    },
  });
});
afterEach(cleanup);

it('runs under the real switch', () => {
  expect(LOCAL_ONLY).toBe(true);
});

it('describes the voice service without a sign-in', () => {
  render(
    <MemoryRouter>
      <VoiceInputSection />
    </MemoryRouter>,
  );
  expect(screen.getByText('countersignLocalOnly.voiceHint')).toBeTruthy();
  expect(screen.queryByText('settings.voiceInput.serviceSource.localHint')).toBeNull();
});
