// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import type { Session } from '@/lib/ccAgent.types';
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { setDataOwnerGeneration } from '@/contexts/dataOwnerGeneration';
import { SessionTaskMenu } from '../SessionTaskMenu';

// I-6: task sharing needs a cloud account. Under the real LOCAL_ONLY switch an active task's
// menu has no Share Task or Manage sharing item, and opening it does not ask main about sharing.
const host = vi.fn();
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ dataOwnerId: 'owner', isAuthenticated: false }),
}));
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function Harness({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const slot = (text: string) => <DropdownMenuItem>{text}</DropdownMenuItem>;
  return (
    <MemoryRouter>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger ref={trigger}>More</DropdownMenuTrigger>
        <SessionTaskMenu
          session={session}
          open={open}
          writeBlocked={false}
          returnFocus={() => trigger.current?.focus()}
          onRename={vi.fn()}
          onPin={vi.fn()}
          onArchive={vi.fn()}
          onUnarchive={vi.fn()}
          onDelete={vi.fn()}
          onOpenInNewWindow={vi.fn()}
          move={slot('move')}
          tags={slot('tags')}
          copy={slot('copy')}
          exportShare={slot('export')}
        />
      </DropdownMenu>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setDataOwnerGeneration('owner');
  host.mockResolvedValue({ available: false, detail: null });
  Object.assign(window, {
    electronAPI: {
      sharedTask: { host, account: vi.fn() },
      deviceLink: { listDevices: vi.fn(async () => ({ devices: [] })), invoke: vi.fn() },
    },
  });
});
afterEach(cleanup);

it('runs under the real switch', () => {
  expect(LOCAL_ONLY).toBe(true);
});

it('offers no Share Task or Manage sharing for an active task', () => {
  render(<Harness session={{ id: 'task', title: 'Task', status: 'active' } as Session} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'More' }), { key: 'Enter' });
  const labels = screen.getAllByRole('menuitem').map((item) => item.textContent);
  expect(labels).toContain('ccAgent.sidebar.sessionMenu.rename');
  expect(labels).not.toContain('sharedTask.title');
  expect(labels).not.toContain('sharedTask.manageSharing');
  expect(labels).not.toContain('sharedTask.leaveShort');
  expect(host).not.toHaveBeenCalled();
});
