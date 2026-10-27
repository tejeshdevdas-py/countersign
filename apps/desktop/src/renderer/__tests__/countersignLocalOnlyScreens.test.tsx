// @vitest-environment jsdom

/**
 * Countersign: screens of removed cloud features show the LocalOnlyError
 * message, and no sign-in CTA is offered.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderView } from '@cindy/model-providers';
import { LOCAL_ONLY, LocalOnlyError } from '@cindy/maker-shared/local-only';

const { providersState, authState } = vi.hoisted(() => ({
  providersState: { providers: [] as unknown[], loading: false },
  authState: { mode: 'local' as string },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

vi.mock('@/hooks/useProviders', () => ({
  useProviders: () => ({ ...providersState, refetch: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ ...authState, exitLocalMode: vi.fn() }),
}));

import { ConnectProviderBanner } from '@/components/onboarding/ConnectProviderBanner';
import { HomeZeroModelAction } from '@/features/cc-agent/HomeZeroModelAction';
import { MarketListError } from '@/features/skillhub/components/MarketListError';
import { localOnlyMessage, localOnlyMessageFromError } from '@/lib/countersignLocalOnly';
import { resetProviderOnboardingDismissal } from '@/state/providerOnboardingDismissal';

afterEach(() => {
  cleanup();
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function inRouter(node: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              {node}
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LocalOnlyError message in the renderer', () => {
  it('is local-only', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('extracts the message from an IPC rejection', () => {
    const ipc = new Error(
      `Error invoking remote method 'provider-share:command': LocalOnlyError: ${new LocalOnlyError('Phone link and sharing').message}`,
    );
    expect(localOnlyMessageFromError(ipc)).toBe(
      "Phone link and sharing is not available in Countersign: it needs a cloud service that this local-only app does not use.",
    );
    expect(localOnlyMessageFromError(new Error('ECONNRESET'))).toBeNull();
    expect(localOnlyMessage('Plugin market')).toBe(new LocalOnlyError('Plugin market').message);
  });

  it('Skill Hub market error shows the message, not "load failed"', () => {
    render(
      <MarketListError
        error={`[UNSUPPORTED_CAPABILITY] ${new LocalOnlyError('Skill Hub').message}`}
        loading={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      'Skill Hub is not available in Countersign',
    );
    expect(screen.queryByText('skillhub.market.loadFailed')).toBeNull();
  });
});

describe('no sign-in CTA under LOCAL_ONLY', () => {
  it('home zero-model card keeps only the own-provider action', () => {
    inRouter(<HomeZeroModelAction authMode="local" narrow={false} />);
    expect(screen.queryByTestId('home-zero-model-cta')).toBeNull();
    expect(screen.getByText('onboarding.connectProvider.title')).toBeTruthy();
    fireEvent.click(screen.getByTestId('home-zero-model-own-api'));
    expect(screen.getByTestId('location').textContent).toBe('/settings?tab=providers&wizard=1');
  });

  it('connect-provider banner leads to providers, not sign-in', () => {
    resetProviderOnboardingDismissal();
    providersState.providers = [
      {
        id: 'xd',
        name: 'Cindy AI',
        source: 'builtin',
        agents: ['claude-code', 'codex'],
        auth: { method: 'managed' },
        routing: {},
        models: { 'claude-code': [], codex: [] },
        connected: false,
      } as unknown as ProviderView,
    ];
    inRouter(<ConnectProviderBanner />);
    expect(screen.queryByText('onboarding.connectProvider.banner.loginCta')).toBeNull();
    fireEvent.click(screen.getByText('onboarding.connectProvider.banner.connectCta'));
    expect(screen.getByTestId('location').textContent).toBe('/settings?tab=providers');
  });
});
