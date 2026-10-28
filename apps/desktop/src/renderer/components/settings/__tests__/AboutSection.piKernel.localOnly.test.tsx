// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}));

import { AgentVersionsRows } from '../AboutSection';
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog-provider';

const getState = vi.fn();
const install = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getState.mockResolvedValue({
    currentVersion: '1.0.2',
    restartRequired: false,
    official: { release: null, checkedAt: null, error: false },
    upstream: { release: { version: '9.9.9' }, checkedAt: 1, error: false },
    operation: null,
  });
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    maker: {
      agent: { getBinaryVersion: vi.fn().mockResolvedValue({ version: '1.0.0' }) },
      piKernel: { getState, install },
    },
    openExternal: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'electronAPI');
});

describe('Pi version row in Countersign', () => {
  it('shows only the installed Pi version: no online check, no update or restore action', async () => {
    render(
      <ConfirmDialogProvider>
        <AgentVersionsRows />
      </ConfirmDialogProvider>,
    );
    await screen.findByText('1.0.2');
    expect(screen.getByText('settings.about.piVersionLabel')).toBeTruthy();
    await waitFor(() => expect(getState).toHaveBeenCalled());
    for (const call of getState.mock.calls) {
      expect(call[0]).toBe(false);
    }
    expect(screen.queryByTestId('pi-kernel-row')).toBeNull();
    expect(screen.queryByRole('button', { name: 'settings.about.piKernel.manage' })).toBeNull();
    expect(screen.queryByText('settings.about.piKernel.available')).toBeNull();
    expect(screen.queryByText('9.9.9')).toBeNull();
    expect(install).not.toHaveBeenCalled();
  });

  it('says the version is unknown when the state cannot be read', async () => {
    getState.mockRejectedValue(new Error('no handler'));
    render(
      <ConfirmDialogProvider>
        <AgentVersionsRows />
      </ConfirmDialogProvider>,
    );
    await waitFor(() =>
      expect(screen.getAllByText('settings.about.version.unknown').length).toBe(1),
    );
    expect(install).not.toHaveBeenCalled();
  });
});
