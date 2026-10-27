// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/useUpdateStatus', () => ({ useUpdateStatus: () => ({ status: 'idle', progress: null }) }));

import { LocalDbFatalScreen } from '../LocalDbFatalScreen';

afterEach(() => cleanup());

describe('LocalDbFatalScreen in Countersign', () => {
  it('has no "check for updates" button when there is no update to find', () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = { checkForUpdate: vi.fn() };
    render(<LocalDbFatalScreen code="MIGRATE_FAILED" message="boom" />);
    expect(screen.queryByText('localDbFatal.noUpdate.checkUpdate')).toBeNull();
    expect(screen.getByText('localDbFatal.noUpdate.title')).toBeTruthy();
  });
});
