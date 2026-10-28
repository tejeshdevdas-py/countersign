import { afterEach, describe, expect, it } from 'vitest';

import { BRAND_NAME } from '@cindy/maker-shared/branding';
import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import i18n from '../index';

// M-J6: SSH remote task errors told the user to switch to "<app> AI", a hosted service that
// does not exist under LOCAL_ONLY. Under the real switch they name only available options.
const LOCALES = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW'] as const;
const CODES = [
  'REMOTE_COMPAT_MODE_UNSUPPORTED',
  'REMOTE_GATEWAY_ENDPOINT_UNAVAILABLE',
  'REMOTE_LOCAL_ONLY_PROVIDER',
  'REMOTE_HOST_PROXY_FORWARD_UNAVAILABLE',
  'REMOTE_NATIVE_OAUTH_UNAVAILABLE',
  'REMOTE_PI_CONTEXT_PROFILE_UNAVAILABLE',
] as const;

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('remote task errors under LOCAL_ONLY', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it.each(LOCALES)('uses the local-only text for each code in %s', async (locale) => {
    await i18n.changeLanguage(locale);
    for (const code of CODES) {
      const local = i18n.t(`countersignLocalOnly.remoteError.${code}`);
      expect(local, code).not.toBe(`countersignLocalOnly.remoteError.${code}`);
      expect(i18n.t(`chat.remoteError.${code}`), code).toBe(local);
    }
  });

  it.each(LOCALES)('names no hosted app AI option in any remote error in %s', async (locale) => {
    await i18n.changeLanguage(locale);
    const bundle = i18n.getResourceBundle(locale, 'common') as {
      chat: { remoteError: Record<string, string> };
    };
    for (const code of Object.keys(bundle.chat.remoteError)) {
      expect(i18n.t(`chat.remoteError.${code}`), code).not.toContain(`${BRAND_NAME} AI`);
    }
  });
});
