/**
 * Countersign guard contract (final fix round 1, journey-2): every built-in tool
 * server in mcp-providers.ts is wrapped by one plugin gate. Under LOCAL_ONLY that
 * gate refuses the chat-app servers (cindy_feishu_bot, cindy_wechat, cindy_slack)
 * before any other rule, including the Codex and Pi deferral that otherwise
 * registers ordinary tools before a working folder is known. mcp-providers.ts
 * cannot be built in a unit test, so this guard-tier test pins the check in its
 * source; isLocalOnlyHiddenPlugin is tested in plugin-registry.localOnly.test.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', '..', 'mcp-integrations', 'mcp-providers.ts'),
  'utf8',
).replace(/\r\n/g, '\n');

describe('chat-app tool servers in Countersign', () => {
  it('imports the LOCAL_ONLY check from the plugin registry', () => {
    expect(source).toMatch(
      /import \{[^}]*\bisLocalOnlyHiddenPlugin\b[^}]*\} from '\.\.\/maker-host\/plugins\/plugin-registry\.js';/,
    );
  });

  it('refuses a hidden plugin first in the plugin gate', () => {
    const gate = source.indexOf('isEnabled: (ctx: LiziMcpSessionContext) => {');
    expect(gate).toBeGreaterThan(-1);
    const check = source.indexOf('if (isLocalOnlyHiddenPlugin(pluginId)) {', gate);
    const deferral = source.indexOf('const deferOrdinaryGate =', gate);
    expect(check).toBeGreaterThan(gate);
    expect(check).toBeLessThan(deferral);
    expect(source.slice(check, check + 80)).toMatch(/\{\s*return false;\s*\}/);
  });
});
