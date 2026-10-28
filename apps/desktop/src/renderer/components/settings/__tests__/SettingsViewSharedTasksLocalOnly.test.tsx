/**
 * Countersign I-6: task sharing needs a cloud account. Under the real LOCAL_ONLY switch the
 * Shared tasks tab is not in the settings menu or search, and no deep link opens it.
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { TAB_IDS, type VisibleSettingsTab } from '@/lib/tabLabels';
import { buildSettingsSearchDocuments } from '../settingsSearchCatalog';
import { SettingsView } from '../SettingsView';

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
vi.mock('@/features/device-link/SharedTaskDialog', () => ({
  SharedTaskDialog: () => <p>Shared tasks page</p>,
}));
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
});

describe('Settings Shared tasks tab under the real LOCAL_ONLY switch', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('hides the tab from the settings menu', () => {
    renderSettings('/settings');
    const tabIds = shownTabIds();
    expect(tabIds).not.toContain('shared-tasks');
    expect(tabIds).toContain('providers');
  });

  it('has no settings search entry for it, even if the tab were listed', () => {
    const t = ((key: string) => key) as unknown as Parameters<
      typeof buildSettingsSearchDocuments
    >[0];
    const documents = buildSettingsSearchDocuments(t, TAB_IDS as readonly VisibleSettingsTab[], {
      region: 'global',
      mode: 'local',
      membershipKind: null,
      platform: 'win32',
    });
    expect(documents.length).toBeGreaterThan(0);
    expect(documents.some((document) => document.entry.tab === 'shared-tasks')).toBe(false);
  });

  it('does not open the Shared tasks page from a deep link', () => {
    renderSettings('/settings?tab=shared-tasks');
    expect(screen.queryByText('Shared tasks page')).toBeNull();
  });
});
