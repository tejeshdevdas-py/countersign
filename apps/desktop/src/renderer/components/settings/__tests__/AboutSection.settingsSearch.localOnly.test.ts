import { describe, expect, it } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { TAB_IDS, type VisibleSettingsTab } from '@/lib/tabLabels';
import { buildSettingsSearchDocuments } from '../settingsSearchCatalog';

// M-J4: under the real LOCAL_ONLY switch, About hides the auto-update, analytics, crash
// upload and log upload rows, so settings search must not offer them either.
const HIDDEN_ABOUT_ENTRIES = [
  'settings.about.autoUpdateLabel',
  'settings.about.analyticsLabel',
  'settings.about.logUpload.crashAutoLabel',
  'settings.about.logUpload.uploadLabel',
];

describe('About settings search under LOCAL_ONLY', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('offers none of the rows About hides, and keeps the ones it shows', () => {
    const t = ((key: string) => key) as unknown as Parameters<
      typeof buildSettingsSearchDocuments
    >[0];
    const ids = buildSettingsSearchDocuments(t, TAB_IDS as readonly VisibleSettingsTab[], {
      region: 'global',
      mode: 'local',
      membershipKind: null,
      platform: 'win32',
    })
      .filter((document) => document.entry.tab === 'about')
      .map((document) => document.entry.id);
    for (const id of HIDDEN_ABOUT_ENTRIES) expect(ids).not.toContain(id);
    expect(ids).toContain('settings.about.debugLogLabel');
    expect(ids).toContain('settings.about.logsDirLabel');
  });
});
