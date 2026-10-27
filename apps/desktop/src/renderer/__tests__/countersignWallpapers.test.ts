import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CINDY_CHARACTER_WALLPAPER_IDS,
  DEFAULT_APPEARANCE_SETTINGS,
  RETIRED_WALLPAPER_IDS,
  SELECTABLE_WALLPAPER_IDS,
  WALLPAPER_IDS,
  normalizeAppearanceSettings,
} from '../../shared/appearanceSettings';
import { getBuiltinWallpaperBackground } from '@/lib/wallpaper';

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(resolve(dir, entry.name)) : [entry.name],
  );
}

describe('Countersign LOCAL_ONLY: no Cindy-character wallpapers', () => {
  it('lists the eight upstream ids', () => {
    expect(CINDY_CHARACTER_WALLPAPER_IDS).toHaveLength(8);
  });

  it('offers and accepts none of them', () => {
    for (const id of CINDY_CHARACTER_WALLPAPER_IDS) {
      expect(SELECTABLE_WALLPAPER_IDS).not.toContain(id);
      expect(RETIRED_WALLPAPER_IDS).not.toContain(id);
      expect(WALLPAPER_IDS).not.toContain(id);
    }
    expect(SELECTABLE_WALLPAPER_IDS).toContain('night-launch');
  });

  it.each(CINDY_CHARACTER_WALLPAPER_IDS)('falls back to the default when %s was saved', (id) => {
    const settings = normalizeAppearanceSettings({ ...DEFAULT_APPEARANCE_SETTINGS, wallpaperId: id });
    expect(settings.wallpaperId).toBe(DEFAULT_APPEARANCE_SETTINGS.wallpaperId);
  });

  it('ships no preview for them', () => {
    for (const id of CINDY_CHARACTER_WALLPAPER_IDS) {
      expect(getBuiltinWallpaperBackground(id)).toBeUndefined();
    }
  });

  it('has no wallpaper file named after Cindy', () => {
    const names = filesUnder(resolve(__dirname, '../assets/wallpapers'));
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => /cindy/i.test(name))).toEqual([]);
  });
});
