/** 「IM 机器人」官方分栏的可见性。个人机器人在所有构建与账号中均可配置。 */

import type { CindyRegion } from '@cindy/maker-shared/brand-identity';
import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

/** 设置搜索仍使用完整身份快照；官方分栏只取登录模式。 */
export interface ImBotIdentity {
  region: CindyRegion;
  mode: 'signed-out' | 'local' | 'cloud';
  membershipKind: 'personal' | 'org' | null;
}

/** 本地模式不提供官方分栏；未登录时仍可看到入口和登录引导。 */
export function showCindyGroup(identity: Pick<ImBotIdentity, 'mode'>): boolean {
  return identity.mode !== 'local';
}

/**
 * Countersign: chat-app bots come later, and their hosts are not on the egress
 * allow-list, so the whole IM tab is hidden under LOCAL_ONLY.
 */
export function canAccessImBotSettings(): boolean {
  return !LOCAL_ONLY;
}
