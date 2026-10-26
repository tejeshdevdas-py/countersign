// @vitest-environment jsdom

/**
 * Countersign: managed (cloud) voice is switched off. Its only UI surface is
 * the dictation start path, which reports the readiness error as a toast and
 * as `lastError`. The main process sets that error to the LocalOnlyError text
 * (voice-input/index.ts `CINDY_VOICE_SERVICE_UNAVAILABLE_MESSAGE`).
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LocalOnlyError } from '@cindy/maker-shared/local-only';

const MESSAGE = new LocalOnlyError('Cloud voice').message;

const toastError = vi.hoisted(() => vi.fn());
vi.mock('@/lib/toast', () => ({
  toast: { error: toastError, warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('@/voice-input/startGuards', () => ({
  resolveVoiceInputStartGuards: vi.fn(async () => ({
    ok: false,
    failed: 'readiness',
    permission: { ok: true, status: 'granted' },
    readiness: { ok: false, error: MESSAGE },
  })),
}));

vi.mock('@/voice-input/captureSession', () => ({
  startVoiceInputCaptureSession: vi.fn(async () => ({ ok: true, drainPendingChunks: () => undefined })),
}));

vi.mock('@/voice-input/startCue', () => ({
  prepareVoiceInputCues: vi.fn(),
  playVoiceInputStartCue: vi.fn(async () => undefined),
  playVoiceInputEndCue: vi.fn(),
}));

vi.mock('@/voice-input/workletUrl', () => ({
  getVoiceInputWorkletUrl: () => '/worklet.js',
}));

import { useAskUserDictation } from '../components/new-chat/useAskUserDictation';

describe('Countersign: cloud voice switched off', () => {
  it('shows the LocalOnlyError message and leaves the listening state', async () => {
    const start = vi.fn(async () => ({ ok: true, runId: 'run-1' }));
    window.electronAPI = {
      platform: 'win32',
      voiceInput: {
        onEvent: () => () => undefined,
        getDataSnapshot: () => ({
          settings: {
            shortcut: null,
            playInteractionSound: false,
            muteSystemAudio: false,
            refinementEnabled: false,
            language: 'auto',
            fastActivationEnabled: false,
            microphoneDeviceId: null,
            dictionaryEntries: [],
            refinementInstructions: '',
          },
        }),
        start,
        stop: async () => ({ ok: true }),
        cancel: async () => ({ ok: true }),
        appendAudio: () => undefined,
        drainAudioQueue: async () => ({ ok: true }),
        muteSystemAudio: async () => ({ ok: true }),
        restoreSystemAudio: async () => ({ ok: true }),
        recordHistory: () => 'hist-1',
        updateHistoryEntry: () => undefined,
        getHistoryForRefinement: () => [],
      },
    } as unknown as typeof window.electronAPI;

    const hook = renderHook(() =>
      useAskUserDictation({
        getText: () => '',
        setText: vi.fn(),
        getSelection: () => ({ start: 0, end: 0 }),
        focus: () => undefined,
      }),
    );

    act(() => {
      hook.result.current.start();
    });
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(MESSAGE));
    expect(MESSAGE).toContain('not available in Countersign');
    expect(hook.result.current.isBusy).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });
});
