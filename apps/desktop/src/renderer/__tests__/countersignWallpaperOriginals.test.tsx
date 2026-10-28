// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { SELECTABLE_WALLPAPER_IDS, type WallpaperId } from '../../shared/appearanceSettings';
import manifest from '../../shared/wallpaper-video-manifest.json';
import { useWallpaperAsset } from '../hooks/useWallpaperAsset';
import {
  getBuiltinWallpaperBackground,
  getBuiltinWallpaperPreview,
  isCdnWallpaper,
} from '../lib/wallpaper';

// I-4: under LOCAL_ONLY the built-in wallpapers are served from the originals bundled
// with the renderer. Nothing asks main to download them, so no Retry can appear.
const BUILT_IN_IDS = SELECTABLE_WALLPAPER_IDS.filter(
  (id) => id !== 'none' && id !== 'custom',
) as WallpaperId[];

const ensureImage = vi.fn();
const ensureVideo = vi.fn();

beforeEach(() => {
  ensureImage.mockReset().mockResolvedValue(null);
  ensureVideo.mockReset().mockResolvedValue(null);
  vi.stubGlobal('electronAPI', {
    appearanceSettings: {
      ensureWallpaperImage: ensureImage,
      ensureWallpaperVideo: ensureVideo,
      onWallpaperDownloadProgress: () => () => undefined,
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Countersign LOCAL_ONLY: built-in wallpapers come from bundled originals', () => {
  it('runs under the real switch and covers the eight built-in ids', () => {
    expect(LOCAL_ONLY).toBe(true);
    expect(BUILT_IN_IDS).toHaveLength(8);
  });

  it.each(BUILT_IN_IDS)('bundles the original of %s byte for byte', (id) => {
    const entry = manifest[id as keyof typeof manifest];
    const bytes = readFileSync(resolve(__dirname, `../assets/wallpapers/${id}.webp`));
    expect(bytes.length).toBe(entry.image.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.image.sha256);
  });

  it.each(BUILT_IN_IDS)('draws %s from the bundled original, not the CDN', (id) => {
    expect(isCdnWallpaper(id)).toBe(false);
    const background = getBuiltinWallpaperBackground(id) ?? '';
    expect(background).toContain(`wallpapers/${id}.webp`);
    expect(background).not.toContain('thumbnails');
    expect(getBuiltinWallpaperPreview(id)).toContain(`thumbnails/${id}.webp`);
  });

  it.each(BUILT_IN_IDS)('never asks main to download %s and never fails', (id) => {
    const image = renderHook(() => useWallpaperAsset(id, 'image', true));
    const video = renderHook(() => useWallpaperAsset(id, 'video', true));
    for (const asset of [image.result.current, video.result.current]) {
      expect(asset.loading).toBe(false);
      expect(asset.failed).toBe(false);
      expect(asset.total).toBe(0);
    }
    expect(ensureImage).not.toHaveBeenCalled();
    expect(ensureVideo).not.toHaveBeenCalled();
  });
});
