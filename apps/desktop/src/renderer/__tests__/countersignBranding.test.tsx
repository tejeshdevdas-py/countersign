// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ThemeBrandLockup } from '@/components/branding/ThemeBrandLockup';
import { BotAvatar } from '@/features/bots/BotAvatar';
import { logoDark, logoLight } from '@/hooks/useBrandLogo';
import { COUNTERSIGN_BRAND_ASSETS } from '@/lib/countersignBrandAssets';
import { cindyDark } from '@/themes/builtin/cindy-dark';
import { cindyLight } from '@/themes/builtin/cindy-light';
import {
  BOT_TEMPLATE_PRESET_AVATARS,
  CINDY_DEFAULT_IDENTITY,
  COUNTERSIGN_DEFAULT_IDENTITY,
  COUNTERSIGN_DEFAULT_TEAMMATE_NAME,
  inferBotTemplatePresetId,
} from '../../shared/botTemplatePreset';

afterEach(cleanup);

/** The asset's own text: Vite inlines small SVGs as data URLs, larger files keep their path. */
function assetSource(src: string): string {
  const inline = /^data:image\/svg\+xml;base64,(.+)$/.exec(src);
  if (inline) return Buffer.from(inline[1], 'base64').toString('utf8');
  const folder = /assets\/countersign\/([^?]+)/.exec(src);
  if (!folder) throw new Error(`not a Countersign asset: ${src}`);
  return readFileSync(resolve(__dirname, '../assets/countersign', folder[1]), 'utf8');
}

describe('Countersign branding', () => {
  it('takes every brand image from the Countersign asset folder', () => {
    const folder = resolve(__dirname, '../assets/countersign');
    const files = {
      wordmarkLight: 'wordmark-light.svg',
      wordmarkDark: 'wordmark-dark.svg',
      markLight: 'mark-light.svg',
      markDark: 'mark-dark.svg',
      teammateAvatar: 'teammate-avatar.svg',
    } as const;
    for (const [key, file] of Object.entries(files)) {
      const src = COUNTERSIGN_BRAND_ASSETS[key as keyof typeof files];
      expect(assetSource(src)).toBe(readFileSync(resolve(folder, file), 'utf8'));
    }
    expect(logoLight).toBe(COUNTERSIGN_BRAND_ASSETS.wordmarkLight);
    expect(logoDark).toBe(COUNTERSIGN_BRAND_ASSETS.wordmarkDark);
  });

  it.each([
    ['light', cindyLight, COUNTERSIGN_BRAND_ASSETS.markLight, COUNTERSIGN_BRAND_ASSETS.wordmarkLight],
    ['dark', cindyDark, COUNTERSIGN_BRAND_ASSETS.markDark, COUNTERSIGN_BRAND_ASSETS.wordmarkDark],
  ] as const)('shows the Countersign mark and wordmark on the %s built-in theme', (_kind, theme, mark, wordmark) => {
    expect(theme.brand).toBeUndefined();
    expect(theme.name).not.toMatch(/cindy/i);

    const view = render(<ThemeBrandLockup theme={theme} testId="brand" />);

    expect(view.getByTestId('brand-icon').querySelector('img')?.getAttribute('src')).toBe(mark);
    const logo = view.getByTestId('brand-logo').querySelector('img');
    expect(logo?.getAttribute('src')).toBe(wordmark);
    expect(logo?.getAttribute('alt')).toBe('Countersign');
  });

  it('draws no Cindy name into the placeholder artwork', () => {
    const folder = resolve(__dirname, '../assets/countersign');
    for (const file of ['wordmark-light.svg', 'wordmark-dark.svg', 'mark-light.svg', 'mark-dark.svg', 'teammate-avatar.svg']) {
      expect(readFileSync(resolve(folder, file), 'utf8')).not.toMatch(/cindy/i);
    }
  });

  it('keeps the notification copy of the teammate avatar byte-identical', () => {
    const renderer = readFileSync(resolve(__dirname, '../assets/countersign/teammate-avatar.svg'));
    const resource = readFileSync(resolve(__dirname, '../../../resources/companion-preset-avatars/countersign-teammate.svg'));
    expect(resource.equals(renderer)).toBe(true);
  });

  it("shows the default teammate's preset with the Countersign avatar", () => {
    const { container } = render(
      <BotAvatar bot={{ name: COUNTERSIGN_DEFAULT_TEAMMATE_NAME, avatar: BOT_TEMPLATE_PRESET_AVATARS.cindy }} />,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe(COUNTERSIGN_BRAND_ASSETS.teammateAvatar);
  });

  it('names the default teammate Countersign and keeps its behaviour', () => {
    expect(COUNTERSIGN_DEFAULT_TEAMMATE_NAME).toBe('Countersign');
    expect(COUNTERSIGN_DEFAULT_IDENTITY).not.toMatch(/Cindy/);
    // Only the name differs from the upstream identity.
    expect(COUNTERSIGN_DEFAULT_IDENTITY).toBe(CINDY_DEFAULT_IDENTITY.replace(/Cindy/g, 'Countersign'));
    expect(inferBotTemplatePresetId(COUNTERSIGN_DEFAULT_IDENTITY)).toBe('cindy');
    expect(inferBotTemplatePresetId(CINDY_DEFAULT_IDENTITY)).toBe('cindy');
  });
});
