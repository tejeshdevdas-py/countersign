/**
 * Countersign (final fix round 1, model-1): the preloaded teammate-guide Skill is
 * written as SKILL.md for every local teammate, so the model reads it. Under the
 * real LOCAL_ONLY it must not name tools that are not registered (the plugin
 * market tools, execution devices) or describe features that are off (other
 * computers under remote control, remote teammates, the phone).
 */
import { describe, expect, it } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import { buildTeammateGuide } from '../teammateGuide.js';

const SWITCHED_OFF = [
  /ghost_market/,
  /execution_device/,
  /other computers?/i,
  /remote control/i,
  /remote teammates?/i,
  /remote host/i,
  /remote-conversation/,
  /check_agent_message/,
  /\bphone\b/i,
  /deviceId::/,
  /device identity/i,
];

const VARIANTS = [
  ['the default guide', {}],
  ['a runtime without plugin authorization cards', { pluginAuthorizationCardsEnabled: false }],
  ['a runtime without the plugin gateway', { cindyAvailable: false }],
  ['a runtime without personal Skills', { ownSkillsEnabled: false }],
] as const;

describe('teammate guide under LOCAL_ONLY', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it.each(VARIANTS)('%s names no switched-off tool or feature', (_name, options) => {
    const guide = buildTeammateGuide(options);
    for (const pattern of SWITCHED_OFF) expect(guide).not.toMatch(pattern);
  });

  it('keeps the installed-plugin gateway and local teammate messaging', () => {
    const guide = buildTeammateGuide();
    expect(guide).toContain('installed-plugin gateway (`ghost_list`, `ghost_info`, `ghost_call`)');
    expect(guide).toContain('Plugins page');
    expect(guide).toContain('`list_agents`');
    expect(guide).toContain('`send_to_agent`');
    expect(guide).toContain('`start_session_task`');
  });
});
