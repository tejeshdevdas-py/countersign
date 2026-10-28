// @vitest-environment jsdom

/**
 * Countersign: under LOCAL_ONLY the home page never offers "Send feedback to
 * the developers" (the issue reporter is off, so the suggestion led nowhere),
 * and "Explore the source" points at this repository, not the upstream one.
 * LOCAL_ONLY is the real value here (true in this build).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import en from '@/i18n/locales/en/common.json';
import ja from '@/i18n/locales/ja/common.json';
import ko from '@/i18n/locales/ko/common.json';
import zhCN from '@/i18n/locales/zh-CN/common.json';
import zhTW from '@/i18n/locales/zh-TW/common.json';

import { HomeSuggestionList } from '../HomeSuggestionList';
import { HOME_SUGGESTION_IDS } from '../homeSuggestions';
import { buildHomeTaskCatalog } from '../pluginHomeSuggestions';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const SHOWN_IDS = HOME_SUGGESTION_IDS.filter((id) => id !== 'sendFeedback');

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('home suggestions in Countersign', () => {
  it('runs with LOCAL_ONLY on', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('leaves the feedback suggestion out of the catalog and keeps every other one', () => {
    const snapshot = { ownerId: null, sources: [], recentIds: [], newlyInstalledId: null };
    const ids = buildHomeTaskCatalog(snapshot, 'en', (key) => key).map((s) => s.id);
    expect(ids).toEqual(SHOWN_IDS);
  });

  it('never shows the feedback suggestion through a full round of shuffles', () => {
    render(<HomeSuggestionList narrow={false} onSelect={vi.fn()} />);
    const seen = new Set<string>();
    for (let index = 0; index < HOME_SUGGESTION_IDS.length; index++) {
      for (const row of screen.getAllByTestId(/^home-suggestion-/)) {
        seen.add(row.getAttribute('data-testid')!.replace('home-suggestion-', ''));
      }
      fireEvent.click(screen.getByTestId('home-suggestions-shuffle'));
    }
    expect(seen).toEqual(new Set(SHOWN_IDS));
  });

  it('points the source suggestion at this repository in every locale', () => {
    for (const locale of [en, ja, ko, zhCN, zhTW]) {
      const prompt = locale.newChat.homeSuggestions.readOwnSource.prompt;
      expect(prompt).toContain('github.com/tejeshdevdas-py/countersign');
      expect(prompt).not.toContain('makecindy');
    }
  });
});
