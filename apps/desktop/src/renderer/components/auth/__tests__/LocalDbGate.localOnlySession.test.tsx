// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

// M-J9: under the real LOCAL_ONLY switch, an auth start-up that leaves no data owner used to
// keep the splash up with no error, because Countersign never redirects to a login page.
// The gate now shows the local data recovery screen, and Retry re-enters local mode.
const h = vi.hoisted(() => ({
  auth: {
    dataOwnerId: null as string | null,
    mode: 'signed-out',
    canEnterApp: false,
    isInitializing: false,
    logout: vi.fn(),
    exitLocalMode: vi.fn(),
    enterLocalMode: vi.fn(),
  },
  report: vi.fn(),
  fatalProps: [] as Array<{ code?: string; message?: string }>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('@/contexts/AppShellCoverContext', () => ({
  useAppShellCover: () => ({ reportLocalDbGate: h.report }),
}));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }));
vi.mock('@/components/error/LocalDbFatalScreen', () => ({
  LocalDbFatalScreen: (props: { code?: string; message?: string; onRetry?: () => void }) => {
    h.fatalProps.push(props);
    return (
      <button type="button" onClick={props.onRetry}>
        fatal screen retry
      </button>
    );
  },
}));

import { LocalDbGate } from '../LocalDbGate';
import {
  LOCAL_SESSION_UNAVAILABLE,
  resolveLocalDbFatalView,
} from '@/components/error/localDbFatalView';

const ensureReady = vi.fn();

beforeEach(() => {
  h.auth.dataOwnerId = null;
  h.auth.canEnterApp = false;
  h.auth.isInitializing = false;
  h.auth.enterLocalMode.mockReset().mockResolvedValue(undefined);
  h.report.mockReset();
  h.fatalProps = [];
  ensureReady.mockReset();
  Object.assign(window, {
    electronAPI: { localDb: { ensureReady }, appReadyForBot: vi.fn() },
  });
});
afterEach(cleanup);

function renderGate() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<LocalDbGate />}>
          <Route index element={<p>app</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

it('runs under the real switch', () => {
  expect(LOCAL_ONLY).toBe(true);
});

it('shows the recovery screen with Retry when start-up left no owner', async () => {
  renderGate();
  const retry = screen.getByRole('button', { name: 'fatal screen retry' });
  expect(h.fatalProps.at(-1)?.message).toBe('countersignLocalOnly.localSessionFailed');
  expect(h.fatalProps.at(-1)?.code).toBe(LOCAL_SESSION_UNAVAILABLE);
  expect(resolveLocalDbFatalView('idle', LOCAL_SESSION_UNAVAILABLE)).toBe('retry-local-db');
  expect(h.report).toHaveBeenCalledWith('fatal');
  expect(ensureReady).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(retry);
  });
  expect(h.auth.enterLocalMode).toHaveBeenCalledTimes(1);
});

it('waits without an error while start-up is still running', () => {
  h.auth.isInitializing = true;
  renderGate();
  expect(screen.queryByRole('button', { name: 'fatal screen retry' })).toBeNull();
  expect(screen.queryByText('app')).toBeNull();
});
