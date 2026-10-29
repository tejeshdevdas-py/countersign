/**
 * Countersign guard contract: the Linux user installer registers exactly the
 * deep-link schemes of BRAND_IDENTITY, like the Windows and macOS paths
 * (`app.setAsDefaultProtocolClient` and forge.config.ts both read
 * allDeepLinkSchemes()). register-desktop.sh is a shell script and cannot
 * import the identity, so this pins its two scheme lists to it.
 *
 * Failure it guards: GitHub CI (Linux) found the script still claiming the
 * upstream `cindy` and `xdt-maker` handlers, which would take an installed
 * Cindy's login and session links away from it. The behavioural test is
 * linuxInstallation.test.ts "registers a valid stable desktop entry ...",
 * which needs Linux, bash and libarchive; this file runs everywhere.
 * Tier: guard (cross-file shell / TypeScript contract).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { allDeepLinkSchemes } from '@cindy/maker-shared/brand-identity';

const script = readFileSync(
  resolve(__dirname, '..', '..', '..', '..', 'resources', 'linux', 'register-desktop.sh'),
  'utf8',
);

function schemesIn(handlers: string[]): string[] {
  return handlers.map((handler) => {
    const match = /^x-scheme-handler\/([a-z0-9.+-]+)$/.exec(handler);
    if (!match) throw new Error(`not a scheme handler: ${handler}`);
    return match[1];
  });
}

describe('Countersign Linux desktop registration schemes', () => {
  const expected = [...allDeepLinkSchemes()];

  it('the desktop entry MimeType lists only the BRAND_IDENTITY schemes', () => {
    const lines = script.match(/MimeType=([^']*)'/g) ?? [];
    expect(lines).toHaveLength(1);
    const value = lines[0]!.slice('MimeType='.length, -1);
    expect(value.endsWith(';')).toBe(true);
    expect(schemesIn(value.slice(0, -1).split(';'))).toEqual(expected);
  });

  it('xdg-mime makes the entry the default for only the BRAND_IDENTITY schemes', () => {
    const lines = script.split('\n').filter((line) => line.startsWith('xdg-mime default '));
    expect(lines).toHaveLength(1);
    const [, , desktopId, ...handlers] = lines[0].trim().split(/\s+/);
    expect(desktopId).toBe('"$id"');
    expect(schemesIn(handlers)).toEqual(expected);
  });
});
