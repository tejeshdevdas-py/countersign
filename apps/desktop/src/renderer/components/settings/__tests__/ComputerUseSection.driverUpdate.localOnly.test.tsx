// @vitest-environment jsdom

// Countersign: under the real LOCAL_ONLY, opening Settings > Computer Use with
// the driver installed does not check GitHub for a driver update. The user can
// still ask with the "Check for updates" button.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, args?: { version?: string }) =>
      args?.version ? `${key}: ${args.version}` : key,
  }),
}));
vi.mock('@/lib/toast', () => ({
  toast: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

import { ComputerUseSection } from '../ComputerUseSection';

const updateKey = 'settings.computerUse.directControl.update';
const versionKey = 'settings.computerUse.directControl.status.version';

function installedStatus(): ComputerDriverStatus {
  return {
    installed: true,
    version: '0.33.0',
    executablePath: 'cua-driver',
    daemonRunning: true,
    installCommand: 'noop',
    docsUrl: 'https://example.invalid/docs',
    permissionState: {
      platform: 'windows',
      required: false,
      canGrant: false,
      status: 'not_required',
      accessibility: 'granted',
      screenRecording: 'granted',
      screenRecordingCapturable: 'granted',
    },
  };
}

function installApi() {
  const computer = {
    status: vi.fn(async () => installedStatus()),
    checkUpdate: vi.fn(async () => ({
      currentVersion: '0.33.0',
      latestVersion: '0.33.0',
      updateAvailable: false,
      updating: false,
      checkStatus: 'success' as const,
      checkedAt: Date.now(),
    })),
    updateDriver: vi.fn(),
    onPermissionGuideStatusChanged: vi.fn(() => () => {}),
    onPermissionGuideCancelled: vi.fn(() => () => {}),
    onUpdateProgress: vi.fn(() => () => {}),
    cancelPermissionGrant: vi.fn(async () => {}),
  };
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      platform: 'win32',
      maker: {
        plugins: {
          getState: vi.fn(async (pluginId: string) => ({
            effectiveEnabled: pluginId === 'computer',
          })),
          setEnabled: vi.fn(async () => ({ codexMcpRefreshed: true })),
        },
        browser: { status: vi.fn(async () => ({ detected: false })) },
        computer,
        android: { getConfig: vi.fn(async () => ({ value: {} })) },
      },
    },
  });
  return computer;
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'electronAPI');
  vi.clearAllMocks();
});

describe('ComputerUseSection driver update check under LOCAL_ONLY', () => {
  it('does not check for a driver update when the tab opens', async () => {
    expect(LOCAL_ONLY).toBe(true);
    const computer = installApi();
    render(<ComputerUseSection />);
    await screen.findByText(`${versionKey}: 0.33.0`);
    await screen.findByText(`${updateKey}.notChecked`);
    expect(computer.checkUpdate).not.toHaveBeenCalled();
    expect(computer.updateDriver).not.toHaveBeenCalled();
  });

  it('checks only when the user asks', async () => {
    const computer = installApi();
    render(<ComputerUseSection />);
    fireEvent.click(await screen.findByRole('button', { name: `${updateKey}.check` }));
    await waitFor(() =>
      expect(computer.checkUpdate).toHaveBeenCalledExactlyOnceWith({ force: true }),
    );
    await screen.findByText(`${updateKey}.upToDate`);
  });
});
