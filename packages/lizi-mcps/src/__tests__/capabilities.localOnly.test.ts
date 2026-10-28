/**
 * Countersign: the capability list the model reads through get_capabilities
 * states Countersign's own facts, and under LOCAL_ONLY it leaves out the
 * issue reporter, whose tool is not registered in this build.
 * LOCAL_ONLY is the real value here (true in this build).
 */
import { describe, expect, it } from 'vitest';
import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import { CAPABILITIES, findCapability, listCapabilityIndex } from '../xdt-helper/capabilities.js';

const FORK_REPOSITORY = 'https://github.com/tejeshdevdas-py/countersign';

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
