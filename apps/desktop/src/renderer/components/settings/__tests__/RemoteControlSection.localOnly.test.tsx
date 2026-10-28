// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

// M-J1: under the real LOCAL_ONLY switch there are no other signed-in devices, so Remote
// Connection describes SSH only.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ mode: 'local' }) }));
vi.mock('@/hooks/useDeviceLinkSettings', () => ({
  useDeviceLinkSettings: () => ({ devices: null }),
}));
vi.mock('../MyDevicesPanel', () => ({ MyDevicesPanel: () => null }));
vi.mock('../RemoteDesktopSetting', () => ({ RemoteDesktopSetting: () => null }));
vi.mock('../RemoteSection', () => ({ RemoteSection: () => null }));
vi.mock('../SettingsSearchNavigation', () => ({
  useSettingsSearchNavigation: () => ({ entry: null, activation: 0 }),
}));

import { RemoteControlSection } from '../RemoteControlSection';

beforeEach(() => {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      remoteSsh: {
        list: vi.fn(async () => ({ hosts: [] })),
        onStatusChanged: () => () => {},
      },
    },
  });
});
afterEach(cleanup);

it('runs under the real switch', () => {
  expect(LOCAL_ONLY).toBe(true);
});

it('describes Remote Connection as SSH only', () => {
  render(
    <MemoryRouter>
      <RemoteControlSection />
    </MemoryRouter>,
  );
  expect(screen.getByText('countersignLocalOnly.remoteControlDescription')).toBeTruthy();
  expect(screen.queryByText('settings.remoteControl.description')).toBeNull();
});
