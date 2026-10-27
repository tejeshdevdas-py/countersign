import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => '',
    get isPackaged() {
      return true;
    },
  },
}));
vi.mock('../../maker-host/logger-adapter.js', () => ({
  desktopMakerLogger: { child: () => ({ info: () => {}, warn: () => {}, error: () => {} }) },
}));

import { isServiceDisabled, type UpstreamService } from '../services';

const ALL: UpstreamService[] = ['analytics', 'heartbeat', 'logUpload', 'updater', 'agentBinaryUpdate', 'imConnectors'];

describe('Countersign upstream background services', () => {
  it.each(ALL)('%s is disabled', (name) => {
    expect(isServiceDisabled(name)).toBe(true);
  });

  it('looks the name up in the disabled set (a name outside it is not disabled)', () => {
    expect(isServiceDisabled('somethingElse' as UpstreamService)).toBe(false);
  });

  it('isReportingBuild is false even when the app is packaged', async () => {
    const { isReportingBuild } = await import('../../analytics-settings-store');
    expect(isReportingBuild()).toBe(false);
  });
});
