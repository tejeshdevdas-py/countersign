// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { localOnlyMessage } from '@/lib/countersignLocalOnly';
import { BotCreateMenu } from '../BotCreateMenu';
import { ChatInviteHost, reportMalformedChatInvite, requestChatInvite } from '../ChatInviteHost';

// M-J5: cloud chat needs the hosted chat service. Under the real LOCAL_ONLY switch the
// teammates menu has no "Enter Invite Link", and an invitation link says that cloud chat is
// not available instead of opening a dialog whose "try again shortly" can never succeed.
const toastSpy = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/toast', () => ({ toast: toastSpy }));
vi.mock('../BotRosterView', () => ({ BotRosterView: () => null }));
vi.mock('../BotGroupCreateDialog', () => ({ BotGroupCreateDialog: () => null }));
vi.mock('../BotMarketDialog', () => ({ BotMarketDialog: () => null }));

const previewInvite = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { maker: { chatServer: { previewInvite, acceptInvite: vi.fn() } } },
  });
});
afterEach(cleanup);

describe('cloud chat invitations under LOCAL_ONLY', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('offers no Enter Invite Link in the teammates menu', () => {
    render(
      <MemoryRouter>
        <BotCreateMenu />
      </MemoryRouter>,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'bots.list.createMenu' }), {
      key: 'Enter',
    });
    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(labels).toContain('bots.list.createTeammate');
    expect(labels).not.toContain('bots.list.joinWithLink');
  });

  it.each([
    ['a valid invitation', () => requestChatInvite('synthetic-invitation-'.padEnd(43, 'a'))],
    ['a damaged invitation', () => reportMalformedChatInvite()],
  ])('says cloud chat is not available for %s and opens no dialog', (_name, open) => {
    render(
      <MemoryRouter>
        <ChatInviteHost />
      </MemoryRouter>,
    );
    act(() => open());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(previewInvite).not.toHaveBeenCalled();
    expect(toastSpy.info).toHaveBeenCalledWith(localOnlyMessage('Cloud chat'));
  });
});
