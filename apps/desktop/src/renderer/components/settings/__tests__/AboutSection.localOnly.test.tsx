// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}));
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/hooks/useExperimentalFeatures', () => ({ useExperimentalFlag: () => ({ enabled: false, setEnabled: vi.fn() }) }));
vi.mock('@/components/ui/confirm-dialog-provider', () => ({ useConfirmDialog: () => ({ confirm: vi.fn() }) }));
vi.mock('@/components/log-support/LogSupportActions', () => ({
  OpenLogsRow: () => <div data-testid="open-logs" />,
  UploadLogsRow: () => <div data-testid="upload-logs" />,
}));
vi.mock('../PiKernelVersionRow', () => ({ PiKernelVersionRow: () => null }));
const hooks = vi.hoisted(() => ({
  auto: vi.fn(() => ({ state: { loading: false } })),
  analytics: vi.fn(() => ({ state: { loading: false } })),
  logUpload: vi.fn(() => ({ state: { loading: false } })),
}));
vi.mock('@/hooks/useAutoUpdateSettings', () => ({ useAutoUpdateSettings: hooks.auto }));
vi.mock('@/hooks/useAnalyticsSettings', () => ({ useAnalyticsSettings: hooks.analytics }));
vi.mock('@/hooks/useLogUploadSettings', () => ({ useLogUploadSettings: hooks.logUpload }));

import { AboutSection } from '../AboutSection';

afterEach(() => cleanup());

describe('AboutSection in Countersign', () => {
  it('hides the update, analytics, crash-upload and upload-logs rows and never reads their settings', () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      maker: { agent: { getBinaryVersion: async () => ({ version: '1.0.0' }) } },
    };
    const { queryByTestId } = render(<AboutSection />);
    expect(queryByTestId('upload-logs')).toBeNull();
    expect(queryByTestId('open-logs')).not.toBeNull();
    expect(hooks.auto).not.toHaveBeenCalled();
    expect(hooks.analytics).not.toHaveBeenCalled();
    expect(hooks.logUpload).not.toHaveBeenCalled();
  });
});
