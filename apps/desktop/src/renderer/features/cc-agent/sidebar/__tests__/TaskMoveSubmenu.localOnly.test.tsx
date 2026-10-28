// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import type { Session } from '@/lib/ccAgent.types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setDataOwnerGeneration } from '@/contexts/dataOwnerGeneration';
import { TaskMoveSubmenu } from '../TaskMoveSubmenu';

// I-8: under the real LOCAL_ONLY switch the Move menu of a desktop task offers no copy to
// another computer, because the device link is off and the device list is always empty.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const listDevices = vi.fn(async () => ({ devices: [] }));

beforeEach(() => {
  vi.clearAllMocks();
  setDataOwnerGeneration('owner');
  Object.assign(window, {
    electronAPI: { deviceLink: { listDevices, invoke: vi.fn(), taskMigration: vi.fn() } },
  });
});
afterEach(cleanup);

it('runs under the real switch', () => {
  expect(LOCAL_ONLY).toBe(true);
});

it.each(['desktop', 'shared', 'feishu'] as const)(
  'offers no copy to another computer for a %s task',
  async (source) => {
    const task = {
      id: 'task',
      title: 'Task',
      status: 'active',
      workspaceKind: 'project',
      workingDir: 'project',
      source,
    } as Session;
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>More</DropdownMenuTrigger>
        <DropdownMenuContent>
          <TaskMoveSubmenu
            session={task}
            disabled={false}
            localProjects={<DropdownMenuItem>local project</DropdownMenuItem>}
            onMigration={vi.fn()}
            onBrowseRemote={vi.fn()}
          />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.keyDown(
      screen.getByRole('menuitem', { name: 'ccAgent.sidebar.sessionMenu.moveToProject' }),
      { key: 'ArrowRight' },
    );
    expect(await screen.findByRole('menuitem', { name: 'local project' })).toBeTruthy();
    await Promise.resolve();
    expect(screen.queryByText('taskMove.otherComputers')).toBeNull();
    expect(screen.queryByText('taskMigration.noDevices')).toBeNull();
  },
);
