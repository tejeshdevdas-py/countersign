// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

// M-J1: under the real LOCAL_ONLY switch there is no account to sign in to. The automatic
// chain lists only hosted models, so the hint says that and points to Custom.
const h = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ warn: vi.fn() }) }));
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ mode: 'local' }) }));
vi.mock('@/components/ui/tooltip', () => ({
  Tip: ({ children }: { children: React.ReactElement }) => children,
}));
vi.mock('@/cindy-brain/OneshotModelPinPicker', () => ({ OneshotModelPinPicker: () => null }));

import { AuxiliaryModelSection } from '../AuxiliaryModelSection';

beforeEach(() => {
  h.get.mockResolvedValue({
    models: [],
    isCustomized: false,
    customizedKeys: [],
    defaults: { models: [] },
    options: [],
  });
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { maker: { auxiliaryModelSettingsGet: h.get, auxiliaryModelSettingsSet: vi.fn() } },
  });
});
afterEach(cleanup);

it('runs under the real switch', () => {
  expect(LOCAL_ONLY).toBe(true);
});

it('explains the automatic chain without asking the user to sign in', async () => {
  render(<AuxiliaryModelSection />);
  expect(await screen.findByText('countersignLocalOnly.auxiliaryHint')).toBeTruthy();
  expect(screen.queryByText('settings.auxiliaryModels.signInHint')).toBeNull();
});
