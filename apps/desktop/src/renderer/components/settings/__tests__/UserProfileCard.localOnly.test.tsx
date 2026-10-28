// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

// M-J1: there is no account to sign in to under the real LOCAL_ONLY switch, so the profile
// card names the local mode instead of saying "Not signed in".
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, mode: 'local', exitLocalMode: vi.fn() }),
}));
vi.mock('@/hooks/useLogout', () => ({ useLogout: () => ({ handleLogout: vi.fn() }) }));
vi.mock('@/lib/makerChatStore', () => ({
  makerChatStore: { getRunningSnapshot: () => new Map() },
}));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/settings/ProfileEditDialog', () => ({ ProfileEditDialog: () => null }));

import { UserProfileCard } from '../UserProfileCard';

afterEach(cleanup);

it('runs under the real switch', () => {
  expect(LOCAL_ONLY).toBe(true);
});

it('names the local mode and says nothing about signing in', () => {
  render(
    <MemoryRouter>
      <UserProfileCard />
    </MemoryRouter>,
  );
  expect(screen.getByText('countersignLocalOnly.profileName')).toBeTruthy();
  expect(screen.queryByText('settings.userProfile.local.name')).toBeNull();
});
