import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

// I-4: under the real LOCAL_ONLY switch, main never resolves the wallpaper CDN. The
// renderer draws the built-in wallpapers from the originals it bundles.
const m = vi.hoisted(() => ({ dir: '', download: vi.fn(), endpoint: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => m.dir, getVersion: () => '1.0.0' } }));
vi.mock('../downloader/index.js', () => ({ createDownloader: () => m.download }));
vi.mock('../clientEndpointsService.js', () => ({ getClientEndpoint: m.endpoint }));
vi.mock('../maker-host/outbound-fetch.js', () => ({ guardedOutboundFetch: vi.fn() }));
vi.mock('../cindy-media/recycler.js', () => ({ recycleClientWallpapers: vi.fn() }));
vi.mock('../custom-wallpaper-settings.js', () => ({
  readReferencedClientWallpaperUrls: () => [],
}));

import { SELECTABLE_WALLPAPER_IDS } from '../../shared/appearanceSettings';
import { ensureWallpaperImage, ensureWallpaperVideo, __testing } from '../wallpaper-video';

const BUILT_IN_IDS = SELECTABLE_WALLPAPER_IDS.filter((id) => id !== 'none' && id !== 'custom');

beforeEach(() => {
  vi.clearAllMocks();
  __testing.reset();
  m.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallpaper-local-only-test-'));
  m.endpoint.mockImplementation(() => {
    throw new Error('getClientEndpoint must not be called under LOCAL_ONLY');
  });
});
afterEach(() => fs.rmSync(m.dir, { recursive: true, force: true }));

describe('Countersign LOCAL_ONLY: no wallpaper download', () => {
  it('runs under the real switch and covers the eight built-in ids', () => {
    expect(LOCAL_ONLY).toBe(true);
    expect(BUILT_IN_IDS).toHaveLength(8);
  });

  it.each(BUILT_IN_IDS)('never resolves the CDN for %s', async (id) => {
    await expect(ensureWallpaperImage(id)).resolves.toBeNull();
    await expect(ensureWallpaperVideo(id)).resolves.toBeNull();
    expect(m.endpoint).not.toHaveBeenCalled();
    expect(m.download).not.toHaveBeenCalled();
  });
});
