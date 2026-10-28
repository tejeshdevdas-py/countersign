// @vitest-environment jsdom
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

// M-J2: the public Skill market needs the hosted service. Under the real LOCAL_ONLY switch
// the Skills page opens on local skills, with no market tabs and no "More" link.
const mocks = vi.hoisted(() => ({
  marketOptions: [] as Array<{ enabled?: boolean }>,
  store: {
    skills: [] as unknown[],
    projects: [],
    bootstrapped: true,
    learnSkillEnabled: false,
    syncResults: new Map(),
  },
  market: {
    items: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    resolvedScope: 'market',
    resolvedMine: false,
    categoryFilter: 'all',
    setSearchQuery: vi.fn(),
    setSortBy: vi.fn(),
    setCatalogScope: vi.fn(),
    setCategoryFilter: vi.fn(),
    setVisibility: vi.fn(),
    loadMore: vi.fn(),
    reload: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, dataOwnerId: 'local-v1', mode: 'local' }),
}));
vi.mock('../hooks/useSkillhub', () => ({ useSkillhub: () => mocks.store, refresh: vi.fn() }));
vi.mock('../hooks/useMarketList', () => ({
  MARKET_PAGE_SIZE: 24,
  useMarketList: (_kind: string, options: { enabled?: boolean }) => {
    mocks.marketOptions.push(options);
    return mocks.market;
  },
  useCategoryList: () => ({ categories: [] }),
}));
vi.mock('../hooks/useMarketManagement', () => ({
  useMarketManagement: () => ({}),
  MarketManagementDialogs: () => null,
}));
vi.mock('../components/InstallTargetPicker', () => ({ InstallTargetPicker: () => null }));
vi.mock('../SkillhubMarketPreviewPanel', () => ({ SkillhubMarketPreviewPanel: () => null }));

import { SkillhubHomeView } from '../SkillhubHomeView';
import { useSkillhubHomeNavigation } from '../hooks/useSkillhubHomeNavigation';
import { visibleHomeCatalogTabs } from '../lib/homeMarketFilter';

beforeEach(() => {
  mocks.marketOptions = [];
  mocks.store.skills = [
    {
      id: 'calendar-tools',
      urlKey: 'skill/global/calendar-tools',
      name: 'calendar-tools',
      engine: 'claude-code',
      kind: 'skill',
      scope: 'global',
      linkedEngines: [],
      absolutePath: '/skills/calendar-tools',
      mdPath: '/skills/calendar-tools/SKILL.md',
      files: [],
      registryEntry: null,
    },
  ];
});
afterEach(cleanup);

describe('Skills page under LOCAL_ONLY', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('offers only the local tab', () => {
    expect(visibleHomeCatalogTabs(false)).toEqual(['local']);
    expect(visibleHomeCatalogTabs(true)).toEqual(['local']);
  });

  it.each(['/skillhub/local', '/skillhub/local?tab=public', '/skillhub/local?tab=organization'])(
    'opens %s on local skills',
    (entry) => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
      );
      const { result } = renderHook(() => useSkillhubHomeNavigation(), { wrapper });
      expect(result.current.catalogTab).toBe('local');
    },
  );

  it('shows local skills with no market tabs, no More link and no market request', () => {
    render(
      <MemoryRouter initialEntries={['/skillhub/local?tab=public']}>
        <SkillhubHomeView embedded />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('calendar-tools').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('radiogroup', { name: 'skillhub.home.catalogFiltersAria' }),
    ).toBeNull();
    expect(screen.queryByRole('radio', { name: 'skillhub.home.catalogFilter.public' })).toBeNull();
    expect(screen.queryByRole('button', { name: /skillhub\.home\.catalogMore/ })).toBeNull();
    expect(mocks.marketOptions.length).toBeGreaterThan(0);
    expect(mocks.marketOptions.every((options) => options.enabled === false)).toBe(true);
  });
});
