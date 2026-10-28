/**
 * Countersign: the capability list the model reads through get_capabilities
 * states Countersign's own facts, and under LOCAL_ONLY it describes the app as
 * it is: no entry for a switched-off feature, and no switched-off part in the
 * entries that stay.
 * LOCAL_ONLY is the real value here (true in this build).
 */
import { describe, expect, it } from 'vitest';
import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import { CAPABILITIES, findCapability, listCapabilityIndex } from '../xdt-helper/capabilities.js';

const FORK_REPOSITORY = 'https://github.com/tejeshdevdas-py/countersign';

/** Entries whose whole subject is off under LOCAL_ONLY. */
const SWITCHED_OFF_KEYS = [
  'issue-tracker',
  'auto-update',
  'feishu-integration',
  'mobile-takeover',
  'jira',
  'confluence',
  'google-sheets',
  'ai-art',
];

/** Words that describe a feature this build switches off (or a tool it does not have). */
const SWITCHED_OFF_TEXT: Array<[string, RegExp]> = [
  ['the app updater', /更新器|cindy-updater|自动更新|install_app_update|check_app_update/],
  ['the skill and plugin market', /市场|Market|发布/],
  ['Feishu and chat-app bots', /飞书|Feishu|\/ctr|私聊|群内|Slack|Telegram|企业微信|钉钉|IM /],
  [
    'other computers, remote control and the phone',
    /跨电脑|跨设备|另一台电脑|其它电脑|其他电脑|已授权电脑|远程控制|设备互联|deviceId|list_history_devices|手机/,
  ],
  ['hosted plugins and the hosted gateway', /ghost 网关|企业档|OAuth|seedance|分享来的供应商/],
  ['issue reporting', /submit_github_issue|官方反馈/],
  [
    'integration tools this build does not have',
    /sheets_read_range|issues_search_jql|image_generate/,
  ],
];

describe('capabilities in Countersign', () => {
  it('runs with LOCAL_ONLY on', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('has no issue-tracker entry and never names the issue tool', () => {
    expect(findCapability('issue-tracker')).toBeUndefined();
    expect(listCapabilityIndex().map((c) => c.key)).not.toContain('issue-tracker');
    const all = CAPABILITIES.map((c) => `${c.title} ${c.oneLiner} ${c.detail}`).join('\n');
    expect(all).not.toContain('submit_github_issue');
  });

  it('leaves out every entry for a feature this build switches off', () => {
    const keys = listCapabilityIndex().map((c) => c.key);
    for (const key of SWITCHED_OFF_KEYS) {
      expect(keys, key).not.toContain(key);
      expect(findCapability(key), key).toBeUndefined();
    }
  });

  it('no entry describes a switched-off feature', () => {
    const hits: string[] = [];
    for (const entry of CAPABILITIES) {
      const text = `${entry.title}\n${entry.oneLiner}\n${entry.detail}`;
      for (const [feature, pattern] of SWITCHED_OFF_TEXT) {
        if (pattern.test(text)) hits.push(`${entry.key}: ${feature}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('keeps the local features, with skills described as local skill management', () => {
    const keys = listCapabilityIndex().map((c) => c.key);
    for (const key of [
      'rich-answers',
      'about-cindy',
      'self-management',
      'ai-chat',
      'collab-mode',
      'session-handoff',
      'session-control',
      'session-management',
      'skillhub',
      'scheduler',
      'chat-history-query',
      'memory-system',
    ]) {
      expect(keys, key).toContain(key);
    }
    expect(findCapability('skillhub')!.detail).toContain('项目级');
  });

  it('about-cindy names the fork and its source, and no upstream maker, site or service', () => {
    const entry = findCapability('about-cindy');
    expect(entry).toBeDefined();
    expect(entry!.detail).toContain(FORK_REPOSITORY);
    expect(entry!.detail).toContain('fork');
    expect(entry!.detail).toContain('无隶属关系');
    expect(entry!.detail).toContain('没有托管服务');
    const text = `${entry!.title} ${entry!.oneLiner} ${entry!.detail}`;
    for (const upstream of [
      'XD Inc. 出品',
      'https://cindy.cn',
      'https://cindy.app',
      '官网',
      '官方',
    ]) {
      expect(text).not.toContain(upstream);
    }
    expect(text).not.toContain('源码 https://github.com/makecindy/cindy');
  });
});
