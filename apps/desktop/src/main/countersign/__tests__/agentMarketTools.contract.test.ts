/**
 * Countersign guard contract (final review, agent-tools ruling): the ghost MCP deps in
 * mcp-providers.ts get the plugin market only through pluginMarketToolDeps, which passes
 * none under LOCAL_ONLY (tested in pluginMarketTools.test.ts). mcp-providers.ts cannot be
 * built in a unit test, so this guard-tier test pins the call site in its source.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', '..', 'mcp-integrations', 'mcp-providers.ts'),
  'utf8',
);

describe('plugin market agent tools in Countersign', () => {
  it('imports the fork helper', () => {
    expect(source).toContain(
      "import { pluginMarketToolDeps } from '../countersign/pluginMarketTools.js';",
    );
  });

  it('passes the market to the ghost MCP deps only through the helper', () => {
    expect(source).toContain('...pluginMarketToolDeps(() => getPluginMarketService()),');
    expect(source).not.toMatch(/\bpluginMarket:\s*getPluginMarketService\(\)/);
  });
});
