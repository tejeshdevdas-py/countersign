// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

// M-J1: syncing contacts between devices needs a signed-in account. Under the real
// LOCAL_ONLY switch the sync row, which only said to sign in, is not shown.
const mocks = vi.hoisted(() => ({
  settingsGet: vi.fn(),
  stats: vi.fn(),
  syncStatusGet: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/contactsService', () => ({
  contactsService: {
    settingsGet: mocks.settingsGet,
    settingsSet: vi.fn(),
    stats: mocks.stats,
    syncStatusGet: mocks.syncStatusGet,
    syncEnabledSet: vi.fn(),
    syncNow: vi.fn(),
    onChanged: () => () => {},
    onSyncStatusChanged: () => () => {},
  },
  contactsErrorI18nKey: () => 'settings.contacts.ipcError.INTERNAL',
}));
vi.mock('../contacts/ContactsManagerDialog', () => ({ ContactsManagerDialog: () => null }));
vi.mock('../contacts/startContactsAiSession', () => ({ prefillContactsAiSessionDraft: vi.fn() }));

import { ContactsSection } from '../contacts/ContactsSection';

beforeEach(() => {
  mocks.settingsGet.mockResolvedValue({ enabled: true, isCustomized: false });
  mocks.stats.mockResolvedValue({ people: 0, orgs: 0, groups: 0, pending: 0 });
  mocks.syncStatusGet.mockResolvedValue({
    available: false,
    enabled: false,
    phase: 'off',
    onlineDeviceCount: 0,
    lastSyncAt: null,
    lastSyncDeviceName: null,
  });
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      maker: {
        plugins: {
          getState: vi.fn(async () => ({ effectiveEnabled: true })),
          setEnabled: vi.fn(),
        },
      },
    },
  });
});
afterEach(cleanup);

it('runs under the real switch', () => {
  expect(LOCAL_ONLY).toBe(true);
});

it('shows no device sync row and no sign-in line', async () => {
  render(<ContactsSection />);
  expect(await screen.findByText('settings.contacts.enable.label')).toBeTruthy();
  expect(screen.queryByText('settings.contacts.sync.label')).toBeNull();
  expect(screen.queryByText('settings.contacts.sync.status.signInRequired')).toBeNull();
  expect(screen.queryByRole('switch', { name: 'settings.contacts.sync.toggleAria' })).toBeNull();
});
