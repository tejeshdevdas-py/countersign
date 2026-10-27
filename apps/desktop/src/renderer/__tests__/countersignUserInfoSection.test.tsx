// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authState, listAccounts } = vi.hoisted(() => ({
  authState: {
    user: null as { name: string; avatar: string | null } | null,
    mode: 'local' as 'cloud' | 'local',
    dataOwnerId: 'local-v1' as string | null,
    isCanary: false,
  },
  listAccounts: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/', search: '' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    ...authState,
    listAccounts,
    syncAccounts: vi.fn(),
    switchAccount: vi.fn(),
  }),
}));

vi.mock('@/components/ui/confirm-dialog-provider', () => ({
  useOptionalConfirmDialog: () => ({ confirm: vi.fn() }),
}));

vi.mock('@/hooks/useUpdateStatus', () => ({
  useUpdateStatus: () => ({ status: 'ready' }),
}));

vi.mock('@/hooks/useUpdateBannerDismiss', () => ({
  useUpdateBannerDismiss: () => ({ dismissed: true, restore: vi.fn() }),
}));

vi.mock('@/hooks/useBetaChannelSettings', () => ({
  useBetaChannelSettings: () => ({ state: { enableBeta: false, isCustomized: false, loading: false } }),
}));

import { UserInfoSection } from '@/components/sidebar/UserInfoSection';

beforeEach(() => {
  authState.user = null;
  authState.mode = 'local';
  listAccounts.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { appDisplayVersion: 'dev', appDisplayVersionDetail: 'dev' },
  });
});

afterEach(cleanup);

describe('UserInfoSection under Countersign LOCAL_ONLY', () => {
  it('shows the product name and version instead of a sign-in state', () => {
    render(<UserInfoSection isCollapsed={false} onOpenUpdateNotice={vi.fn()} />);

    expect(screen.getByText('Countersign')).toBeTruthy();
    expect(screen.getByText('dev')).toBeTruthy();
    expect(screen.queryByText('settings.userProfile.local.name')).toBeNull();
  });

  it.each([false, true])('has no phone or device-link entry (collapsed: %s)', (isCollapsed) => {
    render(<UserInfoSection isCollapsed={isCollapsed} />);

    expect(screen.queryByRole('button', { name: 'sidebar.user.downloadMobile' })).toBeNull();
  });

  it('has no release-notes or update entry, even with a pending update', () => {
    render(<UserInfoSection isCollapsed={false} onOpenUpdateNotice={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'sidebar.user.viewReleaseNotes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'sidebar.user.reopenUpdateBanner' })).toBeNull();
  });

  it('offers Settings but no sign-in in the menu', async () => {
    render(<UserInfoSection isCollapsed={false} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'sidebar.user.moreLabel' }), {
      button: 0,
      ctrlKey: false,
    });

    expect(await screen.findByRole('menuitem', { name: 'sidebar.user.menuSettings' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'login.signIn' })).toBeNull();
    expect(listAccounts).not.toHaveBeenCalled();
  });
});
