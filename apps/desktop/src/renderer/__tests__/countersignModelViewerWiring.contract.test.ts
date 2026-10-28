/**
 * Countersign guard contract (final review I-1): main-entry.tsx sets the
 * <model-viewer> decoder locations under LOCAL_ONLY before the first render.
 * model-viewer reads `self.ModelViewerElement` when an element is created, and
 * main-entry cannot be imported in a unit test (it renders the app), so this
 * guard-tier test pins the wiring in its source. The locations themselves are
 * tested in lib/__tests__/countersignModelViewerOffline.test.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '..', 'main-entry.tsx'), 'utf8');

const CALL = 'if (LOCAL_ONLY) configureModelViewerOffline(self);';

describe('main-entry model-viewer locations in Countersign', () => {
  it('imports the switch and the fork module', () => {
    expect(source).toContain("import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';");
    expect(source).toContain(
      "import { configureModelViewerOffline } from './lib/countersignModelViewerOffline';",
    );
  });

  it('configures the locations once, before the first render', () => {
    const call = source.indexOf(CALL);
    expect(call, 'the LOCAL_ONLY call is in main-entry').toBeGreaterThan(0);
    expect(source.indexOf(CALL, call + 1), 'the call appears once').toBe(-1);
    expect(call).toBeLessThan(source.indexOf('createRoot(rootElement)'));
    expect(call).toBeLessThan(source.indexOf('root.render('));
  });

  it('sets no decoder location of its own that names a host', () => {
    expect(source).not.toMatch(/(?:draco|ktx2|lottie)\w*Location\s*[:=]/i);
  });
});
