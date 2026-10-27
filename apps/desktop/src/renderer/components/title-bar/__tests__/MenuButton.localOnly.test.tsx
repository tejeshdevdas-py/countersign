// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/', search: '' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/lib/checkForUpdateWithToast', () => ({ checkForUpdateWithToast: vi.fn() }));
vi.mock('@/features/device-link/useSharedTaskTasks', () => ({ useSharedTaskTasks: vi.fn() }));
vi.mock('@/features/device-link/JoinSharedTaskDialog', () => ({ JoinSharedTaskDialog: () => null }));
vi.mock('@/features/device-link/SharedTaskEndedNotice', () => ({ SharedTaskEndedNotice: () => null }));

import { MenuButton } from '@/components/title-bar/MenuButton';

afterEach(() => cleanup());

describe('MenuButton in Countersign', () => {
  it('has no "Check for updates" item', async () => {
    const user = userEvent.setup();
    render(<MenuButton />);
    await user.click(screen.getByRole('button', { name: 'titleBar.menu' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.queryByText('titleBar.menuItems.checkForUpdates')).toBeNull();
    expect(screen.getByText('titleBar.menuItems.issues')).toBeTruthy();
  });
});
