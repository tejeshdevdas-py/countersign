import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { PROVIDER_NAME_TO_PLUGIN_ID } from '../builtin-plugins.js';
import { PluginRegistry, isLocalOnlyHiddenPlugin } from '../plugin-registry.js';
import { SettingsReader } from '../settings-reader.js';

// M-J7: the chat-app connectors are off under LOCAL_ONLY, so Settings > Tools and the
// teammate capability catalog (both read listPlugins) must not offer their tools.
const CHAT_APP_TOOL_IDS = ['feishu_bot', 'wechat', 'slack'];

let userDataPath: string;
let registry: PluginRegistry;

beforeEach(() => {
  userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-local-only-'));
  const settingsReader = new SettingsReader({ logger: { warn: vi.fn() }, userDataPath });
  registry = new PluginRegistry({ settingsReader });
});
afterEach(() => fs.rmSync(userDataPath, { recursive: true, force: true }));

describe('builtin tool list under LOCAL_ONLY', () => {
  it('runs under the real switch, and the registry still knows the three tools', () => {
    expect(LOCAL_ONLY).toBe(true);
    const ids = registry.getPlugins().map((plugin) => plugin.id);
    for (const id of CHAT_APP_TOOL_IDS) expect(ids).toContain(id);
  });

  it.each([
    ['Settings user default', undefined, false],
    ['Settings project scope', 'project', false],
    ['the complete capability catalog', undefined, true],
  ] as const)('lists no chat-app tool for %s', async (_name, scope, includeHidden) => {
    const workingDir = scope ? userDataPath : undefined;
    const ids = (await registry.listPlugins(workingDir, includeHidden)).map((item) => item.id);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of CHAT_APP_TOOL_IDS) expect(ids).not.toContain(id);
    expect(ids).toContain('docs');
  });
});

// journey-2: hiding the tools from the list also took away the user's switch, so the
// tool servers themselves must be off: no session gets cindy_feishu_bot, cindy_wechat
// or cindy_slack under LOCAL_ONLY, whatever an older settings file says.
describe('chat-app tool servers under LOCAL_ONLY', () => {
  it.each(CHAT_APP_TOOL_IDS)('%s is off by default, for a project, and after a user toggle', async (id) => {
    expect(registry.isEnabled(id)).toBe(false);
    expect(registry.isEnabled(id, userDataPath)).toBe(false);
    await registry.setEnabled(id, true);
    await registry.setProjectEnabled(id, userDataPath, true);
    expect(registry.isEnabled(id)).toBe(false);
    expect(registry.isEnabled(id, userDataPath)).toBe(false);
    expect((await registry.getEnableState(id, userDataPath)).effectiveEnabled).toBe(false);
  });

  it('freezes the three tools off for a new runtime and leaves other tools alone', () => {
    const disabled = registry.getDisabledRuntimePluginIds(userDataPath);
    for (const id of CHAT_APP_TOOL_IDS) expect(disabled).toContain(id);
    expect(registry.isEnabled('docs')).toBe(true);
  });

  it('maps the three tool servers to the hidden plugin ids', () => {
    const hiddenServers = Object.entries(PROVIDER_NAME_TO_PLUGIN_ID)
      .filter(([, pluginId]) => isLocalOnlyHiddenPlugin(pluginId))
      .map(([server]) => server)
      .sort();
    expect(hiddenServers).toEqual(['cindy_feishu_bot', 'cindy_slack', 'cindy_wechat']);
  });
});
