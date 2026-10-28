// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { localOnlyMessage } from '@/lib/countersignLocalOnly';
import { setDataOwnerGeneration } from '@/contexts/dataOwnerGeneration';
import { JoinSharedTaskDialog } from '../JoinSharedTaskDialog';

// I-6: a shared-task invitation link still opens the join dialog. Under the real LOCAL_ONLY
// switch it says task sharing is not available instead of asking the user to sign in to an
// account that does not exist.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ dataOwnerId: 'local-v1', isAuthenticated: false, user: null }),
}));
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const account = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  setDataOwnerGeneration('local-v1');
  Object.assign(window, {
    electronAPI: {
      logToMain: vi.fn(),
      sharedTask: { account, host: vi.fn() },
      deviceLink: { openLink: vi.fn(), closeLink: vi.fn(), invoke: vi.fn() },
    },
  });
});
afterEach(cleanup);

it('runs under the real switch', () => {
  expect(LOCAL_ONLY).toBe(true);
});

it('says task sharing is not available and asks for no sign-in', () => {
  render(
    <MemoryRouter>
      <JoinSharedTaskDialog
        open
        initialInvitation="https://example.invalid/join"
        onOpenChange={vi.fn()}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(localOnlyMessage('Task sharing'))).toBeTruthy();
  expect(screen.queryByText('sharedTask.login')).toBeNull();
  expect(account).not.toHaveBeenCalled();
});
