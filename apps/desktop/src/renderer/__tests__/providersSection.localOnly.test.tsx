// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import type { ProviderView } from '@cindy/model-providers';

// I-7, under the real LOCAL_ONLY switch: no pinned hosted-service row with the upstream
// company's mark.

const { wizardSpy, providersState } = vi.hoisted(() => ({
  wizardSpy: vi.fn(),
  providersState: { providers: [] as unknown[], order: [] as string[] },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('@/hooks/useProviders', () => ({
  useProviders: () => ({
    providers: providersState.providers,
    providerOrder: providersState.order,
    ownerGeneration: 1,
    loading: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useOptionalAuthUser: () => null,
  useAuth: () => ({ mode: 'local', exitLocalMode: vi.fn(async () => undefined) }),
}));
vi.mock('@/hooks/useCodexAuth', () => ({
  isChatGptConnectionConnected: () => false,
  useCodexAuth: () => ({
    state: { kind: 'unauthenticated' },
    reconnectCredentialScope: undefined,
    recoveryCheck: 'idle',
    refresh: vi.fn(async () => undefined),
    triggerLogin: vi.fn(async () => 'authenticated'),
    cancelLogin: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  }),
}));
vi.mock('@/hooks/useApiKey', () => ({
  useApiKey: () => ({ key: '', hasSavedKey: false, clearKey: vi.fn() }),
}));
vi.mock('@/hooks/useModelAccessStatus', () => ({
  useModelAccessStatus: () => ({ state: 'failed', source: null, endpoint: null }),
}));
vi.mock('@/components/ui/confirm-dialog-provider', () => ({
  useConfirmDialog: () => ({ confirm: vi.fn(async () => true) }),
}));
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/providerModels', () => ({ providerMonogram: () => 'X' }));
vi.mock('@/lib/providerSubtitle', () => ({
  customProviderSubtitleForDisplay: () => '',
  providerSubtitleForDisplay: () => 'subtitle',
}));
vi.mock('@/state/modelVisibilityPrefs', () => ({
  isModelEnabled: () => true,
  setModelVisibilities: vi.fn(() => true),
  setModelVisibility: vi.fn(),
  useModelVisibilityVersion: () => 0,
}));
vi.mock('@/components/settings/AddProviderWizard', () => ({
  AddProviderWizard: (props: { entry?: unknown }) => {
    wizardSpy(props.entry);
    return React.createElement('div', { 'data-testid': 'wizard-stub' });
  },
}));
vi.mock('@/components/settings/useProviderSubscriptionCard', () => ({
  useProviderSubscriptionCard: vi.fn(() => null),
}));
vi.mock('@/components/settings/LlamaCppProviderDetail', () => ({
  LlamaCppProviderDetail: () => null,
}));
vi.mock('@/components/settings/OllamaProviderDetail', () => ({ OllamaProviderDetail: () => null }));

import { ProvidersSection } from '@/components/settings/ProvidersSection';
import { __testing as localProviderGroupsTesting } from '@/features/provider-group/useLocalProviderGroups';

const UPSTREAM_MARK = 'svg[viewBox="136 137 282 158"]';

function makeProvider(id: string, over?: Partial<ProviderView>): ProviderView {
  return {
    id,
    name: id,
    source: 'builtin',
    agents: ['claude-code'],
    auth: { method: 'apiKey' },
    routing: {},
    models: { 'claude-code': [] },
    connected: false,
    ...over,
  } as unknown as ProviderView;
}

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/settings${search}`]}>
      <ProvidersSection />
    </MemoryRouter>,
  );
}

const groupCommand = vi.fn(async () => ({}));
const getDeviceLinkState = vi.fn(async () => ({ remoteControlEnabled: false }));

beforeEach(() => {
  localProviderGroupsTesting.reset();
  wizardSpy.mockReset();
  providersState.providers = [];
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    maker: {
      listProviders: vi.fn(async () => ({
        providers: providersState.providers,
        dataOwnerId: 'owner',
        ownerGeneration: 1,
      })),
      setProviderPresentation: vi.fn(async () => ({ ok: true })),
      onProviderOAuthProgress: vi.fn(() => () => undefined),
      scanLocalCli: vi.fn(async () => ({ detections: [] })),
      llamaCppStatus: vi.fn(async () => ({
        installed: false,
        supported: true,
        running: false,
        models: [],
      })),
      localModelStatus: vi.fn(async () => ({ kind: 'ready' })),
      onLocalModelStatus: vi.fn(() => () => undefined),
      requestProviderModelsAutoRefresh: vi.fn(async () => ({ ok: true })),
      setProviderOrder: vi.fn(async () => ({ ok: true })),
    },
    deviceLink: {
      getState: getDeviceLinkState,
      listDevices: vi.fn(async () => ({ devices: [] })),
      onPresenceChanged: () => () => undefined,
      onControlTargetChanged: () => () => undefined,
    },
    providerGroup: { command: groupCommand, onChanged: () => () => undefined },
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localProviderGroupsTesting.reset();
});

describe('ProvidersSection under the real LOCAL_ONLY switch', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('pins no hosted-service row and shows the add-provider empty state when nothing is connected', async () => {
    renderAt('?tab=providers');
    expect(await screen.findByText('settings.providers.detail.emptyList')).toBeTruthy();
    expect(document.querySelector(UPSTREAM_MARK)).toBeNull();
    expect(screen.queryByText('settings.providers.xd.title')).toBeNull();
    expect(screen.queryByText('settings.providers.xdSignin.badge')).toBeNull();
  });

  it('does not open the hosted-service pane from a connect=xd link', async () => {
    renderAt('?tab=providers&connect=xd');
    expect(await screen.findByTestId('wizard-stub')).toBeTruthy();
    expect(document.querySelector(UPSTREAM_MARK)).toBeNull();
    expect(screen.queryByText('settings.providers.xd.title')).toBeNull();
  });
});
