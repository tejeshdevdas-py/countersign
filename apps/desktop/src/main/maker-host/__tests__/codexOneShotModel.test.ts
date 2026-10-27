import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogModel } from '@cindy/model-providers';

const state = vi.hoisted(() => ({
  discovered: [] as CatalogModel[],
  overrides: {} as { disabledModels?: Record<string, boolean> },
}));

vi.mock('../active-catalog.js', () => ({
  getDiscoveredCodexModels: () => state.discovered,
}));
vi.mock('../model-disable-store.js', () => ({
  readModelDisableOverrides: () => state.overrides,
}));

import {
  CODEX_BUILTIN_ONESHOT_MODEL,
  isCodexModelListedForAccount,
  pickCodexOneShotModel,
  resolveCodexOneShotModel,
} from '../codex-oneshot-model.js';

function model(id: string, sortOrder?: number): CatalogModel {
  return { id, name: id, ...(sortOrder === undefined ? {} : { sortOrder }) } as CatalogModel;
}

// The model list the owner's ChatGPT-login Codex discovered on 2026-10-27
// (codex-home/models_cache.json, visibility "list" only). It has no gpt-5.4-mini.
const CHATGPT_ACCOUNT_MODELS = [
  model('gpt-6.1-terra', 1),
  model('gpt-6.1-sol', 0),
  model('gpt-6-astra', 3),
  model('gpt-5.6-luna', 8),
];

describe('pickCodexOneShotModel', () => {
  it('uses the account’s first listed model when it lacks gpt-5.4-mini (ChatGPT login)', () => {
    expect(pickCodexOneShotModel(CHATGPT_ACCOUNT_MODELS)).toBe('gpt-6.1-sol');
  });

  it('keeps gpt-5.4-mini when the account lists it', () => {
    expect(pickCodexOneShotModel([model('gpt-6.1-sol', 0), model(CODEX_BUILTIN_ONESHOT_MODEL, 5)]))
      .toBe(CODEX_BUILTIN_ONESHOT_MODEL);
  });

  it('returns undefined when no account list has been discovered', () => {
    expect(pickCodexOneShotModel([])).toBeUndefined();
  });

  it('skips models switched off in Settings', () => {
    expect(pickCodexOneShotModel(CHATGPT_ACCOUNT_MODELS, {
      isDisabled: (id) => id === 'gpt-6.1-sol',
    })).toBe('gpt-6.1-terra');
    expect(pickCodexOneShotModel(CHATGPT_ACCOUNT_MODELS, { isDisabled: () => true })).toBeUndefined();
  });

  it('puts models without a picker position last', () => {
    expect(pickCodexOneShotModel([model('unranked'), model('ranked', 4)])).toBe('ranked');
  });
});

describe('isCodexModelListedForAccount', () => {
  it('answers from the account list, null when unknown', () => {
    expect(isCodexModelListedForAccount('gpt-5.4-mini', CHATGPT_ACCOUNT_MODELS)).toBe(false);
    expect(isCodexModelListedForAccount('gpt-6.1-sol', CHATGPT_ACCOUNT_MODELS)).toBe(true);
    expect(isCodexModelListedForAccount('gpt-5.4-mini', [])).toBeNull();
  });
});

describe('resolveCodexOneShotModel', () => {
  beforeEach(() => {
    state.discovered = [];
    state.overrides = {};
  });

  it('reads the live discovered list', () => {
    expect(resolveCodexOneShotModel()).toBeUndefined();
    state.discovered = CHATGPT_ACCOUNT_MODELS;
    expect(resolveCodexOneShotModel()).toBe('gpt-6.1-sol');
  });

  it('honours a per-model switch-off for the openai source', () => {
    state.discovered = CHATGPT_ACCOUNT_MODELS;
    state.overrides = { disabledModels: { 'openai:gpt-6.1-sol': true } };
    expect(resolveCodexOneShotModel()).toBe('gpt-6.1-terra');
  });
});
