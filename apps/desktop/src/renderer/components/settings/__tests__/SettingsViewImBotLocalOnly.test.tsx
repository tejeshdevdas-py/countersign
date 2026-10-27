/**
 * Countersign: chat-app bots (IM) come later. Under LOCAL_ONLY the IM tab is
 * hidden from the settings menu and search, and no deep link opens it.
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VisibleSettingsTab } from '@/lib/tabLabels';
import { buildSettingsSearchDocuments } from '../settingsSearchCatalog';
import { SettingsView } from '../SettingsView';

const flags = vi.hoisted(() => ({ localOnly: true }));
vi.mock('@cindy/maker-shared/local-only', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cindy/maker-shared/local-only')>()),
  get LOCAL_ONLY() {
    return flags.localOnly;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ mode: 'local', dataOwnerId: null, user: null }),
}));
vi.mock('@/lib/useCindyVersions', () => ({
  useCindyVersions: () => ({ state: 'idle' }),
}));

const { Stub } = vi.hoisted(() => ({ Stub: () => null }));
vi.mock('../UserProfileCard', () => ({ UserProfileCard: Stub }));
vi.mock('../VoiceInputSection', () => ({ VoiceInputSection: Stub }));
vi.mock('../AppearanceSection', () => ({ AppearanceSection: Stub }));
vi.mock('../SubagentModelSection', () => ({ SubagentModelSection: Stub }));
vi.mock('../AuxiliaryModelSection', () => ({ AuxiliaryModelSection: Stub }));
vi.mock('../VisionBridgeSection', () => ({ VisionBridgeSection: Stub }));
vi.mock('../ProvidersSection', () => ({ ProvidersSection: Stub }));
vi.mock('../McpServersSection', () => ({ McpServersSection: Stub }));
vi.mock('../RemoteControlSection', () => ({ RemoteControlSection: Stub }));
vi.mock('@/features/device-link/SharedTaskDialog', () => ({ SharedTaskDialog: Stub }));
vi.mock('../NotificationSection', () => ({ NotificationSection: Stub }));
vi.mock('../WindowBehaviorSection', () => ({ WindowBehaviorSection: Stub }));
vi.mock('../ComposerSendShortcutSection', () => ({ ComposerSendShortcutSection: Stub }));
vi.mock('../KeyboardShortcutsSection', () => ({ KeyboardShortcutsSection: Stub }));
vi.mock('../AgentIslandSection', () => ({ AgentIslandSection: Stub }));
vi.mock('../LanguageSection', () => ({ LanguageSection: Stub }));
vi.mock('../LogoutSection', () => ({ LogoutSection: Stub }));
vi.mock('../AboutSection', () => ({ AboutSection: Stub }));
vi.mock('../WorktreeRecycleCard', () => ({ WorktreeRecycleCard: Stub }));
vi.mock('../StorageManagementCard', () => ({ StorageManagementCard: Stub }));
vi.mock('../UserPromptSection', () => ({ UserPromptSection: Stub }));
vi.mock('../MemorySection', () => ({ MemorySection: Stub }));
vi.mock('../CompactionSection', () => ({ CompactionSection: Stub }));
vi.mock('../TerminalShellSection', () => ({ TerminalShellSection: Stub }));
vi.mock('../LinkOpenSection', () => ({ LinkOpenSection: Stub }));
vi.mock('../StreamFadeSection', () => ({ StreamFadeSection: Stub }));
vi.mock('../TipsSection', () => ({ TipsSection: Stub }));
vi.mock('../ExperimentalSection', () => ({ ExperimentalSection: Stub }));
vi.mock('../GitSafetySection', () => ({ GitSafetySection: Stub }));
vi.mock('../SessionImportSection', () => ({ SessionImportSection: Stub }));
vi.mock('../AgentResourceSection', () => ({ AgentResourceSection: Stub }));
vi.mock('../CollaborationSection', () => ({ CollaborationSection: Stub }));
vi.mock('../BuiltinToolsSection', () => ({ BuiltinToolsSection: Stub }));
vi.mock('../contacts/ContactsSection', () => ({ ContactsSection: Stub }));
vi.mock('../ComputerUseSection', () => ({ ComputerUseSection: Stub }));
vi.mock('../CindyMakeSection', () => ({ CindyMakeSection: Stub }));
vi.mock('../SettingsCatalogPanel', () => ({ SettingsCatalogPanel: Stub }));
vi.mock('@/features/billing/BillingPage', () => ({ BillingSettingsSection: Stub }));
vi.mock('@/features/bots/BotsGlobalSettingsSection', () => ({ BotsGlobalSettingsSection: Stub }));
vi.mock('../usage/UsageHistorySection', () => ({ UsageHistorySection: Stub }));
vi.mock('../SettingsSidebarNav', () => ({
  SettingsSidebarNav: ({ tabIds }: { tabIds: readonly string[] }) => (
    <ul aria-label="settings tabs">
      {tabIds.map((id) => (
        <li key={id}>{id}</li>
      ))}
    </ul>
  ),
}));
vi.mock('../ImBotSection', () => ({
  ImBotSection: () => <p>IM bots page</p>,
  isImBotSettingsGroup: (value: unknown) => value === 'cindy' || value === 'personal',
}));
vi.mock('../PiPackagesSection', () => ({ PiPackagesSection: Stub }));
vi.mock('../HelpSection', () => ({ HelpSection: Stub }));
vi.mock('../HelpAssistantPanel', () => ({ HelpAssistantPanel: Stub }));

function renderSettings(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/settings" element={<SettingsView />} />
      </Routes>
    </MemoryRouter>,
  );
}

function shownTabIds(): string[] {
  const list = screen.getByRole('list', { name: 'settings tabs' });
  return Array.from(list.querySelectorAll('li')).map((item) => item.textContent ?? '');
}

beforeEach(() => {
  vi.stubGlobal('electronAPI', { platform: 'win32', appVersion: '1.0.0' });
  Element.prototype.scrollTo = () => {};
});

afterEach(() => {
  vi.unstubAllGlobals();
  flags.localOnly = true;
});

describe('Settings IM tab under LOCAL_ONLY', () => {
  it('hides the IM tab from the menu and from settings search', () => {
    renderSettings('/settings');
    const tabIds = shownTabIds();
    expect(tabIds).not.toContain('im-bot');
    expect(tabIds).toContain('providers');
    const t = ((key: string) => key) as unknown as Parameters<typeof buildSettingsSearchDocuments>[0];
    const documents = buildSettingsSearchDocuments(t, tabIds as VisibleSettingsTab[], {
      region: 'global',
      mode: 'local',
      membershipKind: null,
      platform: 'win32',
    });
    expect(documents.some((document) => document.entry.tab === 'im-bot')).toBe(false);
  });

  it.each([
    '/settings?tab=im-bot',
    '/settings?tab=im-bot&imGroup=personal',
    '/settings?tab=feishu-bot',
    '/settings?tab=slack-bot',
    '/settings?tab=tina',
  ])('does not open IM setup from the deep link %s', (entry) => {
    renderSettings(entry);
    expect(screen.queryByText('IM bots page')).toBeNull();
  });

  it('shows the IM tab and opens it from a deep link without LOCAL_ONLY', () => {
    flags.localOnly = false;
    renderSettings('/settings?tab=im-bot');
    expect(shownTabIds()).toContain('im-bot');
    expect(screen.getByText('IM bots page')).toBeTruthy();
  });
});
