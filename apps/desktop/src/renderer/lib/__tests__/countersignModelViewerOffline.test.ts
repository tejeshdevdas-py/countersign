// Countersign: <model-viewer> loads its Draco and KTX2 decoders from
// www.gstatic.com and its Lottie loader from cdn.jsdelivr.net unless
// self.ModelViewerElement names other locations before the first element is
// created. Under the real LOCAL_ONLY those locations are local and missing.

import { describe, expect, it } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import {
  configureModelViewerOffline,
  MODEL_VIEWER_OFFLINE_LOCATIONS,
} from '../countersignModelViewerOffline';

const KEYS = ['dracoDecoderLocation', 'ktx2TranscoderLocation', 'lottieLoaderLocation'] as const;

function namesAHost(url: string): boolean {
  return /^\s*(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url);
}

describe('model-viewer decoder locations under LOCAL_ONLY', () => {
  it('sets every remote-default location to a local path', () => {
    expect(LOCAL_ONLY).toBe(true);
    const target: { ModelViewerElement?: Record<string, unknown> } = {};
    configureModelViewerOffline(target);
    for (const key of KEYS) {
      const value = target.ModelViewerElement?.[key];
      expect(typeof value, key).toBe('string');
      expect(namesAHost(value as string), `${key}=${String(value)}`).toBe(false);
      expect(value).toBe(MODEL_VIEWER_OFFLINE_LOCATIONS[key]);
    }
    // DRACOLoader and KTX2Loader append file names to these folders.
    expect(MODEL_VIEWER_OFFLINE_LOCATIONS.dracoDecoderLocation.endsWith('/')).toBe(true);
    expect(MODEL_VIEWER_OFFLINE_LOCATIONS.ktx2TranscoderLocation.endsWith('/')).toBe(true);
  });

  it('keeps settings that are already there', () => {
    const target: { ModelViewerElement?: Record<string, unknown> } = {
      ModelViewerElement: { debugMode: true, powerPreference: 'low-power' },
    };
    configureModelViewerOffline(target);
    expect(target.ModelViewerElement).toMatchObject({
      debugMode: true,
      powerPreference: 'low-power',
    });
  });
});
