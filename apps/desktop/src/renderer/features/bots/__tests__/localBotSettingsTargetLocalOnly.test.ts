// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { localBotSettingsTarget } from '../localBotSettingsTarget';

// Countersign: a teammate's own chat-app bots come later. Under LOCAL_ONLY the
// teammate settings on this computer offer no Channels (message platform) page.
describe('local teammate settings under LOCAL_ONLY', () => {
  it('has no Channels page', () => {
    expect(localBotSettingsTarget.pages.has('channels')).toBe(false);
  });

  it('keeps the other pages', () => {
    for (const page of ['profile', 'personality', 'memory', 'model', 'capabilities', 'routines']) {
      expect(localBotSettingsTarget.pages.has(page)).toBe(true);
    }
  });
});
