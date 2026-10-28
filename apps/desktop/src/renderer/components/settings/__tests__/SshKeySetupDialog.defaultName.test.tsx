// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { brandHomeStateName } from '@cindy/maker-shared/brand-identity';
import { i18n, SUPPORTED_LOCALES } from '@/i18n';

// M-C1: the key form offers the BRAND_IDENTITY default name (countersign), not cindy.
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { SshKeySetupDialog } from '../SshKeySetupDialog';

beforeEach(() => {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      platform: 'win32',
      remoteSsh: { listLocalKeys: vi.fn(async () => ({ keys: [] })) },
    },
  });
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

it('shows the Countersign default key name in the generate form', async () => {
  const name = brandHomeStateName();
  render(<SshKeySetupDialog hostId={null} open onOpenChange={() => {}} />);

  fireEvent.click(await screen.findByText('Generate new'));

  expect(screen.getByPlaceholderText(name)).toBeTruthy();
  expect(screen.getByText(new RegExp(`Defaults to "${name}"`))).toBeTruthy();
  expect(screen.queryByPlaceholderText('cindy')).toBeNull();
});

it('names the default key through {{defaultName}} in every locale', async () => {
  const name = brandHomeStateName();
  for (const locale of SUPPORTED_LOCALES) {
    await i18n.changeLanguage(locale);
    const hint = i18n.t('settings.remote.keys.nameHint', { defaultName: name });
    expect(hint).toContain(name);
    expect(hint).not.toMatch(/cindy|\{\{/i);
  }
});
