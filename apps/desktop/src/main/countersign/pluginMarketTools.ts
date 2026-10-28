import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

/**
 * Countersign: the plugin market is off under LOCAL_ONLY. The ghost MCP server registers
 * ghost_market_search and ghost_market_install only when it is given a market, so while
 * the market is off it gets none and the model is not offered those tools. Plugins from a
 * marketplace the user configured are installed from the Plugins page instead.
 */
export function pluginMarketToolDeps<Market>(create: () => Market): { pluginMarket?: Market } {
  if (LOCAL_ONLY) {
    return {};
  }
  return { pluginMarket: create() };
}
