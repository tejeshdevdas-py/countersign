// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { COUNTERSIGN_BRAND_ASSETS } from '@/lib/countersignBrandAssets';

// I-10: the startup splash and login canvas show no upstream character portrait and no
// slogan. They draw the Countersign avatar above the Countersign wordmark.
const handoff = vi.hoisted(() => ({
  brandStageMounted: true,
  brandLayout: 'splash' as 'splash' | 'login',
  brandExiting: false,
  isPlaying: false,
  phase: 'splash',
  sloganRevealed: false,
  panelBottomReserve: 0,
  reportBrandAssetsReady: vi.fn(),
}));
vi.mock('@/contexts/LoginHandoffContext', () => ({
  LOGIN_HANDOFF_TIMINGS: {
    panelMs: 420,
    panelEasing: 'ease',
    sloganMs: 500,
    sloganEasing: 'ease',
  },
  useLoginHandoff: () => handoff,
}));
vi.mock('@/components/markdown/useIsDarkMode', () => ({ useIsDarkMode: () => false }));

import { LoginBrandStage } from '../LoginBrandStage';

beforeEach(() => {
  handoff.reportBrandAssetsReady.mockReset();
  handoff.sloganRevealed = false;
});
afterEach(cleanup);

function imageSources(): string[] {
  return Array.from(document.querySelectorAll('img')).map(
    (image) => image.getAttribute('src') ?? '',
  );
}

describe('Countersign login brand stage', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it.each([false, true])('draws no portrait and no slogan (slogan revealed: %s)', (revealed) => {
    handoff.sloganRevealed = revealed;
    render(<LoginBrandStage />);
    expect(screen.queryByTestId('login-brand-hero')).toBeNull();
    expect(screen.queryByTestId('login-slogan')).toBeNull();
    for (const src of imageSources()) {
      expect(src).not.toMatch(/login\/(hero|slogan)/);
      expect(src).not.toMatch(/(^|\/)(hero|slogan)[^/]*\.png/);
    }
  });

  it('draws the Countersign avatar and the Countersign wordmark', () => {
    render(<LoginBrandStage />);
    const avatar = screen.getByTestId('login-brand-avatar') as HTMLImageElement;
    expect(avatar.getAttribute('src')).toBe(COUNTERSIGN_BRAND_ASSETS.lockupAvatar);
    const wordmark = screen.getByTestId('login-brand-wordmark') as HTMLImageElement;
    expect(wordmark.getAttribute('src')).toContain('countersign/login-wordmark-light');
    expect(imageSources()).toHaveLength(2);
  });

  it('reports the brand assets ready once both images settle', () => {
    render(<LoginBrandStage />);
    fireEvent.load(screen.getByTestId('login-brand-avatar'));
    expect(handoff.reportBrandAssetsReady).not.toHaveBeenCalled();
    fireEvent.error(screen.getByTestId('login-brand-wordmark'));
    expect(handoff.reportBrandAssetsReady).toHaveBeenCalledTimes(1);
  });
});
