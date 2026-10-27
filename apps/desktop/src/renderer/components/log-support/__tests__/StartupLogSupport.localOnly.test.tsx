// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ canEnterApp: false, isInitializing: true, isAuthenticated: false, mode: 'signed-out' }),
}));
vi.mock('@/contexts/AppShellCoverContext', () => ({
  useAppShellCover: () => ({ localDbGateStatus: 'pending', coverHeld: false }),
}));
vi.mock('@/contexts/EnvCheckContext', () => ({ useEnvCheck: () => ({ status: 'passed' }) }));
vi.mock('@/contexts/LoginHandoffContext', () => ({
  useLoginHandoff: () => ({
    brandStageMounted: false,
    phase: 'done',
    branch: null,
    panelRevealed: true,
    startSignals: { loginPanelMounted: false },
  }),
}));
vi.mock('../useStartupGateStallReport', () => ({ useStartupGateStallReport: vi.fn() }));
vi.mock('../useManualLogUpload', () => ({ useManualLogUpload: () => ({}) }));
vi.mock('../LogSupportActions', () => ({
  OpenLogsRow: () => <div data-testid="open-logs" />,
  UploadLogsActionRow: () => <div data-testid="upload-logs" />,
}));
vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, content }: { open: boolean; content?: ReactNode }) =>
    open ? <div>{content}</div> : null,
}));

import { StartupLogSupport } from '../StartupLogSupport';

afterEach(() => cleanup());

describe('StartupLogSupport in Countersign', () => {
  it('offers open-logs but not log upload', () => {
    render(<StartupLogSupport />);
    fireEvent.click(screen.getByRole('button', { name: 'logSupport.title' }));
    expect(screen.queryByTestId('open-logs')).not.toBeNull();
    expect(screen.queryByTestId('upload-logs')).toBeNull();
  });
});
