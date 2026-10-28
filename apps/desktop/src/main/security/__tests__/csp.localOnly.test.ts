// Countersign: under the real LOCAL_ONLY the app window's policy does not name
// the Google Fonts stylesheet host. The drawio preview no longer loads remote
// fonts (renderer/lib/countersignDrawioOffline.ts), so nothing needs it.

import { describe, expect, it } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import { buildContentSecurityPolicy } from '../csp';

function styleSources(policy: string): string[] {
  const directive = policy
    .split(';')
    .map((chunk) => chunk.trim().split(/\s+/))
    .find(([name]) => name === 'style-src');
  return directive ? directive.slice(1) : [];
}

describe('CSP style-src under LOCAL_ONLY', () => {
  for (const isDev of [false, true]) {
    it(`${isDev ? 'dev' : 'prod'}: keeps self and inline styles, names no font host`, () => {
      expect(LOCAL_ONLY).toBe(true);
      const sources = styleSources(
        buildContentSecurityPolicy({
          isDev,
          devServerOrigin: isDev ? 'http://localhost:5173' : null,
        }),
      );
      expect(sources).toEqual(["'self'", "'unsafe-inline'"]);
      expect(sources.join(' ')).not.toMatch(/googleapis/);
    });
  }
});
