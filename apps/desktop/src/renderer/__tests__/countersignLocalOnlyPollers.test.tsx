// @vitest-environment jsdom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchReleaseNotes, fetchReleaseNotesIndex } = vi.hoisted(() => ({
  fetchReleaseNotes: vi.fn(async () => null),
  fetchReleaseNotesIndex: vi.fn(async () => null),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => ({ effectiveLocale: 'en' }) }));
vi.mock('@/release-notes', () => ({ fetchReleaseNotes, fetchReleaseNotesIndex }));

import { useBetaChannelSettings } from '@/hooks/useBetaChannelSettings';
import { useUpdateNotice } from '@/hooks/useUpdateNotice';
import { useUpdateStatus } from '@/hooks/useUpdateStatus';
import { useTaskMigrationStatus } from '@/features/cc-agent/TaskMigrationStatus';
import { ensureProviderShareReceivedStarted } from '@/features/provider-share/providerShareStore';
import type { Session } from '@/lib/ccAgent.types';

const api = {
  appVersion: '1.0.0',
  getUpdateStatus: vi.fn(async () => ({ status: 'idle' })),
  onUpdateStatus: vi.fn(() => () => undefined),
  getUpdateChannelSettings: vi.fn(async () => ({ enableBeta: false })),
  onUpdateChannelSettings: vi.fn(() => () => undefined),
  providerShare: {
    command: vi.fn(async () => []),
    onReceivedChanged: vi.fn(() => () => undefined),
  },
  deviceLink: {
    taskMigration: vi.fn(async () => ({})),
    onRemotePush: vi.fn(() => () => undefined),
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  for (const fn of [
    api.getUpdateStatus,
    api.onUpdateStatus,
    api.getUpdateChannelSettings,
    api.onUpdateChannelSettings,
    api.providerShare.command,
    api.providerShare.onReceivedChanged,
    api.deviceLink.taskMigration,
    fetchReleaseNotes,
    fetchReleaseNotesIndex,
  ]) {
    fn.mockClear();
  }
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: api });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Countersign LOCAL_ONLY stops pollers of removed services', () => {
  it('reads no update status (update-get-status has no handler)', async () => {
    const { result } = renderHook(() => useUpdateStatus());
    await vi.advanceTimersByTimeAsync(60_000);

    expect(api.getUpdateStatus).not.toHaveBeenCalled();
    expect(api.onUpdateStatus).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('reads no update channel settings and is not left loading', async () => {
    const { result } = renderHook(() => useBetaChannelSettings());
    await vi.advanceTimersByTimeAsync(1_000);

    expect(api.getUpdateChannelSettings).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ enableBeta: false, isCustomized: false, loading: false });
  });

  it('fetches no release notes at start', async () => {
    renderHook(() => useUpdateNotice());
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchReleaseNotes).not.toHaveBeenCalled();
    expect(fetchReleaseNotesIndex).not.toHaveBeenCalled();
  });

  it('does not poll task-copy status every 10 s', async () => {
    const session = { id: 'session-1', deviceLinkDeviceId: null, remoteHostId: null } as unknown as Session;
    renderHook(() => useTaskMigrationStatus(session));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(api.deviceLink.taskMigration).not.toHaveBeenCalled();
  });

  it('never starts the provider-share received store or its retry loop', async () => {
    ensureProviderShareReceivedStarted();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(api.providerShare.command).not.toHaveBeenCalled();
    expect(api.providerShare.onReceivedChanged).not.toHaveBeenCalled();
  });
});
