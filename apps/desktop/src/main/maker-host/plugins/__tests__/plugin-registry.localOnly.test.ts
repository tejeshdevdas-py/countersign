import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { PluginRegistry } from '../plugin-registry.js';
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
