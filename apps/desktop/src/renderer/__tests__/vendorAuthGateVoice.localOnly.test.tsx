// @vitest-environment jsdom
/**
 * Countersign (final fix round 1, journey-1): with default settings under the real
 * LOCAL_ONLY, voice input uses an API-key speech service that is not set up. The gate
 * must not name the hosted "{{appName}} AI" service or send the user to Model
 * Providers, which cannot connect it; it asks for a realtime speech recognition
 * service and opens Settings > Voice input.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

const confirm = vi.fn(async (_options: { title: string; description: string }) => true);
const navigate = vi.fn();

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/ui/confirm-dialog-provider', () => ({
  useConfirmDialog: () => ({ confirm }),
}));
vi.mock('@/hooks/useVendorReadiness', () => ({
  useVendorReadiness: () => ({ revalidate: vi.fn() }),
}));
vi.mock('@/features/device-link/remoteProjectsStore', () => ({
  remoteProjectsStore: { getDeviceName: () => 'unused' },
}));

import { useVendorAuthGate } from '@/hooks/useVendorAuthGate';

const notReady = (auth: 'api-key' | 'codex') => ({
  ok: false as const,
  auth,
  settingsTab: 'providers' as const,
});

let readiness: ReturnType<typeof notReady>;

beforeEach(() => {
  readiness = notReady('api-key');
  vi.stubGlobal('electronAPI', {
    voiceInput: {
      getReadinessCached: () => null,
      getReadiness: async () => readiness,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  confirm.mockClear();
  navigate.mockClear();
});

describe('voice input gate under LOCAL_ONLY', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('asks for a speech service and opens Settings > Voice input, not Model Providers', async () => {
    const { result } = renderHook(() => useVendorAuthGate());

    await expect(result.current.checkAndConfirm('cc', { purpose: 'voice-input' })).resolves.toEqual(
      { proceed: false },
    );

    expect(confirm).toHaveBeenCalledTimes(1);
    const shown = confirm.mock.calls[0]![0];
    expect(shown.title).toBe('countersignLocalOnly.voiceSetupTitle');
    expect(shown.description).toBe('countersignLocalOnly.voiceSetupDescription');
    expect(JSON.stringify(shown)).not.toMatch(/voiceApiKeyAuth|voiceDirectApiKeyAuth/);
    expect(navigate).toHaveBeenCalledWith('/settings?tab=voice-input');
  });

  it('keeps the ChatGPT sign-in message for the Codex speech service', async () => {
    readiness = notReady('codex');
    const { result } = renderHook(() => useVendorAuthGate());

    await result.current.checkAndConfirm('cc', { purpose: 'voice-input' });

    expect(confirm.mock.calls[0]![0].title).toBe('logic.confirm.codexVoiceAuthTitle');
    expect(navigate).toHaveBeenCalledWith('/settings?tab=providers');
  });
});
