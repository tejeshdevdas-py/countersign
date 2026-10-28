// @vitest-environment jsdom

/**
 * Countersign: the "Recognize my voice" speaker filter needs models that
 * download only from the upstream project's CDN, which local mode never
 * contacts. Under LOCAL_ONLY its card does not render (and never asks the main
 * process for its status), and settings search does not list it.
 * LOCAL_ONLY is the real value here (true in this build).
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import voiceInputSearch from '../VoiceInputSection.settings-search';
import type { SettingsSearchContext } from '../settingsSearchTypes';
import { VoiceSpeakerFilterCard } from '../VoiceSpeakerFilterCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('@/components/ui/tooltip', () => ({
  Tip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/ui/confirm-dialog-provider', () => ({
  useConfirmDialog: () => ({ confirm: vi.fn(async () => true) }),
}));

afterEach(() => cleanup());

describe('speaker filter in Countersign', () => {
  it('runs with LOCAL_ONLY on', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('renders no card on Windows and never reads the filter status', () => {
    const status = {
      supported: true,
      modelState: 'missing',
      downloadedBytes: 0,
      totalBytes: 1,
      enrolled: false,
    };
    const speakerFilter = {
      getStatus: vi.fn(async () => status),
      downloadModels: vi.fn(async () => status),
      onStatusChanged: vi.fn(() => () => {}),
    };
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { platform: 'win32', voiceInput: { speakerFilter } },
    });
    const { container } = render(
      <VoiceSpeakerFilterCard
        enabled={false}
        strictness="standard"
        strictnessCustomized={false}
        microphoneDeviceId={null}
        onEnabledChange={vi.fn()}
        onStrictnessChange={vi.fn()}
        onStrictnessReset={vi.fn(async () => true)}
      />,
    );
    expect(container.innerHTML).toBe('');
    expect(speakerFilter.getStatus).not.toHaveBeenCalled();
    expect(speakerFilter.downloadModels).not.toHaveBeenCalled();
  });

  it('is not listed in settings search on Windows or macOS', () => {
    const entry = voiceInputSearch.entries.find(
      (e) => e.id === 'settings.voiceInput.speakerFilter.label',
    );
    expect(entry?.isVisible).toBeDefined();
    for (const platform of ['win32', 'darwin']) {
      expect(entry!.isVisible!({ platform } as SettingsSearchContext)).toBe(false);
    }
  });
});
