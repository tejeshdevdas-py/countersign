import { afterEach, describe, expect, it } from 'vitest';

import { BRAND_NAME } from '@cindy/maker-shared/branding';
import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import en from '../locales/en/common.json';
import ja from '../locales/ja/common.json';
import ko from '../locales/ko/common.json';
import zhCN from '../locales/zh-CN/common.json';
import zhTW from '../locales/zh-TW/common.json';
import i18n from '../index';

// journey-4 and journey-5: under LOCAL_ONLY no string the app can show names the hosted
// "<app> AI" service or "<app> account services", neither of which exists in Countersign.
const RAW = { en, ja, ko, 'zh-CN': zhCN, 'zh-TW': zhTW } as const;
const LOCALES = Object.keys(RAW) as Array<keyof typeof RAW>;
const ACCOUNT_SERVICES: Record<keyof typeof RAW, string> = {
  en: 'account services',
  ja: 'アカウントサービス',
  ko: '계정 서비스',
  'zh-CN': '账号服务',
  'zh-TW': '帳號服務',
};

function flatten(value: unknown, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

function neutralTable(locale: keyof typeof RAW): Record<string, string> {
  return (RAW[locale].countersignLocalOnly as { neutral: Record<string, string> }).neutral;
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('hosted service and account wording under LOCAL_ONLY', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('has the same neutral keys in every locale', () => {
    const keys = Object.keys(neutralTable('en')).sort();
    expect(keys.length).toBeGreaterThan(0);
    for (const locale of LOCALES) {
      expect(Object.keys(neutralTable(locale)).sort(), locale).toEqual(keys);
    }
  });

  it.each(LOCALES)('replaces only strings that exist upstream in %s', (locale) => {
    const upstream = new Map(flatten(RAW[locale]));
    for (const key of Object.keys(neutralTable(locale))) {
      expect(typeof upstream.get(key), key).toBe('string');
    }
  });

  it.each(LOCALES)('names no app AI service and no account services in %s', async (locale) => {
    await i18n.changeLanguage(locale);
    const bundle = i18n.getResourceBundle(locale, 'common') as Record<string, unknown>;
    const offenders = flatten(bundle)
      .filter(
        ([, text]) => text.includes('{{appName}} AI') || text.includes(ACCOUNT_SERVICES[locale]),
      )
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it.each(LOCALES)('shows the neutral text through t() in %s', async (locale) => {
    await i18n.changeLanguage(locale);
    for (const [key, text] of Object.entries(neutralTable(locale))) {
      const shown = i18n.t(key);
      expect(shown, key).toBe(text.replaceAll('{{appName}}', BRAND_NAME));
      expect(shown, key).not.toContain(`${BRAND_NAME} AI`);
      expect(text, key).not.toContain('{{appName}} AI');
    }
    expect(i18n.t('scheduler.editor.preRunHook.aiFailure.no_candidate')).not.toContain(
      `${BRAND_NAME} AI`,
    );
  });
});
