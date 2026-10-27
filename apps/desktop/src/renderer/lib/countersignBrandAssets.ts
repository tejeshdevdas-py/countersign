/**
 * Countersign brand artwork: the single place the renderer takes it from.
 *
 * The files in `src/renderer/assets/countersign/` are neutral placeholders
 * (text and a monogram, no Cindy artwork). To ship the real artwork, drop
 * files in with the same names and change the extensions below if they are
 * PNG. All files need a transparent background.
 *
 * - `wordmark-light.*` / `wordmark-dark.*`: the horizontal wordmark, dark ink
 *   for light themes and light ink for dark themes. Shown at 110 x 37.5 px on
 *   the new-chat screen and as the loading mark (aspect ratio 2048:699), so
 *   ship 2048 x 699 px PNG or an SVG with that viewBox.
 * - `mark-light.*` / `mark-dark.*`: the round icon left of the wordmark,
 *   cropped to a 50 px circle. Ship 200 x 200 px or larger (square).
 * - `teammate-avatar.*`: the default teammate's avatar, shown round at up to
 *   about 128 px. Ship 256 x 256 px (square). Desktop notifications read a
 *   copy at `resources/companion-preset-avatars/countersign-teammate.*`
 *   (see `PRESET_AVATAR_FILES` in `src/main/agent-island/companionIdentity.ts`),
 *   which must stay byte-identical.
 */
import markDark from '@/assets/countersign/mark-dark.svg';
import markLight from '@/assets/countersign/mark-light.svg';
import teammateAvatar from '@/assets/countersign/teammate-avatar.svg';
import wordmarkDark from '@/assets/countersign/wordmark-dark.svg';
import wordmarkLight from '@/assets/countersign/wordmark-light.svg';

export const COUNTERSIGN_BRAND_ASSETS = {
  wordmarkLight,
  wordmarkDark,
  markLight,
  markDark,
  teammateAvatar,
} as const;
