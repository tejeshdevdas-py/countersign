// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
    i18n: { exists: () => false, language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

import { ErrorMessageCard } from '@/components/chat/ErrorMessageCard';
import { parseLoadedContextOverflow } from '@/utils/loadedContextOverflow';
import { classifyProviderError } from '../../shared/providerErrors';

// The error the live run got from LM Studio through the Pi engine (2026-10-27).
const LM_STUDIO_ERROR =
  'Engine protocol predict request returned 400: {"error":{"code":400,"message":"request (10849 tokens) exceeds the available context size (8192 tokens), try increasing it","type":"exceed_context_size_error","n_prompt_tokens":10849,"n_ctx":8192}}';

afterEach(cleanup);

describe('local model loaded-context overflow', () => {
  it('reads both numbers from the LM Studio / llama.cpp error', () => {
    expect(parseLoadedContextOverflow(LM_STUDIO_ERROR)).toEqual({ requestTokens: 10849, loadedContextTokens: 8192 });
  });

  it('reads the JSON fields when only the error type is present', () => {
    const escaped = '{\\"type\\":\\"exceed_context_size_error\\",\\"n_prompt_tokens\\":300,\\"n_ctx\\":256}';
    expect(parseLoadedContextOverflow(escaped)).toEqual({ requestTokens: 300, loadedContextTokens: 256 });
  });

  it('ignores other errors', () => {
    expect(parseLoadedContextOverflow('prompt is too long: 250000 tokens > 200000 maximum')).toBeNull();
    expect(parseLoadedContextOverflow(undefined)).toBeNull();
  });

  it('classifies the provider response as context too long', () => {
    const body = LM_STUDIO_ERROR.slice(LM_STUDIO_ERROR.indexOf('{'));
    expect(classifyProviderError({ status: 400, bodyText: body }).code).toBe('CONTEXT_TOO_LONG');
  });

  it('says what to change instead of a generic failure', () => {
    render(createElement(ErrorMessageCard, { message: LM_STUDIO_ERROR, reason: 'context-overflow' }));

    expect(
      screen.getByText('chat.errorBanner.loadedContextTooSmall {"loaded":8192,"request":10849}'),
    ).toBeTruthy();
    expect(screen.queryByText('chat.errorBanner.replyFailed')).toBeNull();
  });

  it.each(['en', 'zh-CN', 'zh-TW', 'ja', 'ko'])('has the %s message with both numbers', (locale) => {
    const file = resolve(__dirname, `../i18n/locales/${locale}/common.json`);
    const message = JSON.parse(readFileSync(file, 'utf8')).chat.errorBanner.loadedContextTooSmall as string;
    expect(message).toContain('{{loaded}}');
    expect(message).toContain('{{request}}');
  });
});
