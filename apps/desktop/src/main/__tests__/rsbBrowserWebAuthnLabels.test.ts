/** RSB WebAuthn 原生账户选择框四语文案的术语门禁。 */
import { describe, expect, it } from 'vitest';
import { RSB_BROWSER_WEBAUTHN_LABELS } from '../rsbBrowserWebAuthnLabels';

import { describeShadowCatalogGlossary, flattenShadowCatalog } from './shadowCatalogGlossary';

describeShadowCatalogGlossary(
  'RSB WebAuthn 原生账户选择框符合术语表',
  flattenShadowCatalog(RSB_BROWSER_WEBAUTHN_LABELS, 'desktop:browser.passkey.'),
  'RSB WebAuthn 原生账户选择框',
);

describe('RSB WebAuthn chooser product name', () => {
  it.each(Object.entries(RSB_BROWSER_WEBAUTHN_LABELS))('%s names Countersign, never Cindy', (_locale, labels) => {
    expect(labels.detail).toContain('Countersign');
    expect(JSON.stringify(labels)).not.toContain('Cindy');
  });
});
