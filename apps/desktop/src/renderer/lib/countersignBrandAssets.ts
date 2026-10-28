/**
 * Countersign brand artwork: the single place the renderer takes it from.
 *
 * Source: the owner's countersign-brand folder (outside this repo), AI-generated
 * for Countersign (see FORK-CHANGES.md), scaled with a Lanczos filter, alpha
 * kept. Files in `src/renderer/assets/countersign/` (all transparent PNG):
 *
 * - `wordmark-light.png` / `wordmark-dark.png` (1024 x 350): the wordmark for
 *   light / dark backgrounds. Shown at 110 x 37.5 px on the new-chat screen and
 *   as the loading mark.
 * - `lockup-avatar.png` (200 x 200): the round icon left of the wordmark,
 *   cropped to a 50 px circle; both themes.
 * - `teammate-avatar.png` (256 x 256): the default teammate's avatar. Desktop
 *   notifications read a byte-identical copy at
 *   `resources/companion-preset-avatars/countersign-teammate.png`
 *   (`PRESET_AVATAR_FILES` in `src/main/agent-island/companionIdentity.ts`).
 * - `login-wordmark-{light,dark}.png` (423 x 145) and `@2x` (846 x 290): the
 *   login screen wordmark, imported by `LoginBrandStage.tsx`.
 */
import lockupAvatar from '@/assets/countersign/lockup-avatar.png';
import teammateAvatar from '@/assets/countersign/teammate-avatar.png';
import wordmarkDark from '@/assets/countersign/wordmark-dark.png';
import wordmarkLight from '@/assets/countersign/wordmark-light.png';

export const COUNTERSIGN_BRAND_ASSETS = {
  wordmarkLight,
  wordmarkDark,
  lockupAvatar,
  teammateAvatar,
} as const;
