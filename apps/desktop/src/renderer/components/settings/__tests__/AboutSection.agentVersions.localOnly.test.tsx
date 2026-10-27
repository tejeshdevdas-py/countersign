// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}));
vi.mock('../PiKernelVersionRow', () => ({ PiKernelVersionRow: () => null }));

import { AgentVersionsRows } from '../AboutSection';
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog-provider';

afterEach(() => cleanup());

describe('AgentVersionsRows in Countersign', () => {
  it('shows only the installed version: no online check, no Update, no check-failed text', async () => {
    const getBinaryVersion = vi.fn().mockResolvedValue({ kind: 'codex', version: '1.0.0', latestCheckFailed: false });
    (window as unknown as { electronAPI: unknown }).electronAPI = { maker: { agent: { getBinaryVersion } } };
    render(
      <ConfirmDialogProvider>
        <AgentVersionsRows />
      </ConfirmDialogProvider>,
    );
    await waitFor(() => expect(screen.getAllByText('1.0.0').length).toBe(2));
    for (const call of getBinaryVersion.mock.calls) {
      expect(call[1]).toBeUndefined();
    }
    expect(screen.queryByRole('button', { name: /harnessManage/ })).toBeNull();
    expect(screen.queryByText('settings.about.harnessCheckFailed')).toBeNull();
    expect(screen.queryByText(/harnessUpdate/)).toBeNull();
  });
});
