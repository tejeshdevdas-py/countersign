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

/** Image sizes read from the PNG header (width, height at bytes 16-23). */
function pngSize(file: string): [number, number] {
  const bytes = readFileSync(resolve(__dirname, '../assets/countersign', file));
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('Countersign branding', () => {
  it('takes every brand image from the Countersign asset folder', () => {
    const files = {
      wordmarkLight: 'wordmark-light.png',
      wordmarkDark: 'wordmark-dark.png',
      lockupAvatar: 'lockup-avatar.png',
      teammateAvatar: 'teammate-avatar.png',
    } as const;
    for (const [key, file] of Object.entries(files)) {
      expect(COUNTERSIGN_BRAND_ASSETS[key as keyof typeof files]).toContain(`assets/countersign/${file}`);
    }
    expect(logoLight).toBe(COUNTERSIGN_BRAND_ASSETS.wordmarkLight);
    expect(logoDark).toBe(COUNTERSIGN_BRAND_ASSETS.wordmarkDark);
  });

  it.each([
    ['wordmark-light.png', 1024, 350],
    ['wordmark-dark.png', 1024, 350],
    ['lockup-avatar.png', 200, 200],
    ['teammate-avatar.png', 256, 256],
    ['login-wordmark-light.png', 423, 145],
    ['login-wordmark-light@2x.png', 846, 290],
    ['login-wordmark-dark.png', 423, 145],
    ['login-wordmark-dark@2x.png', 846, 290],
  ] as const)('ships %s at %ix%i', (file, width, height) => {
    expect(pngSize(file)).toEqual([width, height]);
  });

  it.each([
    ['light', cindyLight, COUNTERSIGN_BRAND_ASSETS.wordmarkLight],
    ['dark', cindyDark, COUNTERSIGN_BRAND_ASSETS.wordmarkDark],
  ] as const)('shows the Countersign avatar and wordmark on the %s built-in theme', (_kind, theme, wordmark) => {
    expect(theme.brand).toBeUndefined();
    expect(theme.name).not.toMatch(/cindy/i);

    const view = render(<ThemeBrandLockup theme={theme} testId="brand" />);

    expect(view.getByTestId('brand-icon').querySelector('img')?.getAttribute('src')).toBe(
      COUNTERSIGN_BRAND_ASSETS.lockupAvatar,
    );
    const logo = view.getByTestId('brand-logo').querySelector('img');
    expect(logo?.getAttribute('src')).toBe(wordmark);
    expect(logo?.getAttribute('alt')).toBe('Countersign');
  });

  it('keeps the notification copy of the teammate avatar byte-identical', () => {
    const renderer = readFileSync(resolve(__dirname, '../assets/countersign/teammate-avatar.png'));
    const resource = readFileSync(resolve(__dirname, '../../../resources/companion-preset-avatars/countersign-teammate.png'));
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
