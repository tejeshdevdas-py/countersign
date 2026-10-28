/**
 * Countersign (final review M-F8): when a dev sandbox's keychain identity is
 * uncertain, the dev build refuses to start and tells the developer how to
 * repair the marker file. resolveDevKeychainDecision accepts only the
 * BRAND_IDENTITY names (executableName and executableNameByRegion.dev), so
 * the recovery steps must name those, not upstream's "Cindy" / "CindyDev".
 * Packaged builds never reach this path.
 */
import { BRAND_IDENTITY } from '@cindy/maker-shared/brand-identity';
import { describe, expect, it } from 'vitest';

import { formatDevKeychainAbortMessage } from '../../devKeychainName';

const message = formatDevKeychainAbortMessage({
  reason: 'marker unreadable',
  markerPath: 'sandbox/keychain-identity',
});

describe('dev keychain abort message', () => {
  it('names the two identities the marker may hold, as BRAND_IDENTITY defines them', () => {
    const dev = BRAND_IDENTITY.executableNameByRegion.dev;
    const defaultName = BRAND_IDENTITY.executableName;
    expect(message).toContain(`"${defaultName}"`);
    expect(message).toContain(`"${dev}"`);
    expect(message).toContain(`${dev} 身份`);
  });

  it('keeps the reason, the marker path and the repair guidance', () => {
    expect(message).toContain('marker unreadable');
    expect(message).toContain('sandbox/keychain-identity');
    expect(message).toContain('原子替换');
    expect(message).toContain('XDT_USER_DATA_DIR');
    expect(message.endsWith('\n')).toBe(true);
  });

  it('no longer names the upstream identities', () => {
    expect(/\bCindy(?:Dev)?\b/.test(message)).toBe(false);
  });
});
