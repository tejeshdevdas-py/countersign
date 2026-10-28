import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { LOCAL_ONLY, LocalOnlyError } from '@cindy/maker-shared/local-only';
import i18n from '@/i18n';
import { localOnlyMessage, localOnlyMessageFromError } from '../countersignLocalOnly';

// M-J3: the "not available in Countersign" message is a locale key with {{feature}} in all
// five common.json files. English stays word for word the main-process LocalOnlyError text.
const LOCALES = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW'] as const;
const KEY = 'countersignLocalOnly.notAvailable';

function localeText(locale: string): unknown {
  const file = resolve(__dirname, '..', '..', 'i18n', 'locales', locale, 'common.json');
  const json = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, unknown>>;
  return json.countersignLocalOnly?.notAvailable;
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Countersign local-only message', () => {
  it('runs under the real switch', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it.each(LOCALES)('has the key with {{feature}} in %s', (locale) => {
    const text = localeText(locale);
    expect(typeof text).toBe('string');
    expect(text).toContain('{{feature}}');
    expect(text).toContain('{{appName}}');
  });

  it('keeps the English text equal to the main-process error', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t(KEY, { feature: 'Plugin market' })).toBe(
      new LocalOnlyError('Plugin market').message,
    );
    expect(localOnlyMessage('Plugin market')).toBe(new LocalOnlyError('Plugin market').message);
  });

  it.each(LOCALES.filter((locale) => locale !== 'en'))(
    'translates the message and a main-process error in %s',
    async (locale) => {
      await i18n.changeLanguage(locale);
      const expected = i18n.t(KEY, { feature: 'Cloud chat' });
      expect(expected).toContain('Cloud chat');
      expect(expected).not.toBe(new LocalOnlyError('Cloud chat').message);
      expect(localOnlyMessage('Cloud chat')).toBe(expected);
      const ipc = new Error(
        `Error invoking remote method 'x': LocalOnlyError: ${new LocalOnlyError('Cloud chat').message}`,
      );
      expect(localOnlyMessageFromError(ipc)).toBe(expected);
    },
  );
});
