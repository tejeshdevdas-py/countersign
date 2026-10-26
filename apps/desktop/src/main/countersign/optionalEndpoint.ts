import { LocalOnlyError } from '@cindy/maker-shared/local-only';
import type { ClientEndpointKey } from '@cindy/maker-shared/client-endpoints';

import { getClientEndpoint } from '../clientEndpointsService.js';

/**
 * Countersign: for callers that only optionally use a cloud endpoint (a cache
 * key, a "not configured" check). Returns null when the endpoint is switched
 * off (`LocalOnlyError`); any other failure still throws.
 */
export function tryGetClientEndpoint(key: ClientEndpointKey): string | null {
  try {
    return getClientEndpoint(key);
  } catch (error) {
    if (error instanceof LocalOnlyError) return null;
    throw error;
  }
}
