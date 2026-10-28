import { describe, expect, it, vi } from 'vitest';

// Countersign: these cases cover upstream's public and organization Skill catalogs, which
// LOCAL_ONLY removes (see ../../__tests__/SkillhubHome.localOnly.test.tsx).
vi.mock('@cindy/maker-shared/local-only', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cindy/maker-shared/local-only')>()),
  LOCAL_ONLY: false,
}));
import {
  homeMarketQuery,
  isHomeMarketResponseCurrent,
  visibleHomeCatalogTabs,
} from '../homeMarketFilter';

describe('Skill home market filters', () => {
  it('maps public and organization to generic catalog scopes', () => {
    expect(homeMarketQuery('public')).toEqual({
      scope: 'market',
      visibility: 'all',
      sort: 'trending',
    });
    expect(homeMarketQuery('organization')).toEqual({
      scope: 'team',
      visibility: 'all',
      sort: 'trending',
    });
  });

  it('places local skills after public and the optional organization tab', () => {
    expect(visibleHomeCatalogTabs(false)).toEqual(['public', 'local']);
    expect(visibleHomeCatalogTabs(true)).toEqual(['public', 'organization', 'local']);
  });

  it('does not present a response from the previous tab as current', () => {
    expect(isHomeMarketResponseCurrent(homeMarketQuery('public'), {
      scope: 'market',
      mine: true,
    })).toBe(false);
    expect(isHomeMarketResponseCurrent(homeMarketQuery('public'), {
      scope: 'market',
      mine: false,
    })).toBe(true);
  });
});
