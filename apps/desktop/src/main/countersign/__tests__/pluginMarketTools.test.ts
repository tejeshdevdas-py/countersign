import { describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { pluginMarketToolDeps } from '../pluginMarketTools';

// Agent-tools ruling: under the real LOCAL_ONLY switch the plugin market is off, so the
// ghost MCP server gets no market and registers no ghost_market_search or ghost_market_install.
describe('plugin market agent tool deps', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('passes no market and never creates one', () => {
    const create = vi.fn(() => ({ snapshot: vi.fn() }));
    expect(pluginMarketToolDeps(create)).toEqual({});
    expect(create).not.toHaveBeenCalled();
  });
});
