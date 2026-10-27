/**
 * Countersign: which model a Codex one-shot (chat titles, help answers, summaries) uses.
 *
 * Upstream sends every Codex one-shot that names no model to `gpt-5.4-mini`, and its
 * automatic auxiliary chain only reaches Codex after the Cindy gateway routes, which
 * LOCAL_ONLY removes. A Codex signed in with a ChatGPT account rejects `gpt-5.4-mini`
 * ("model is not supported when using Codex with a ChatGPT account", model_not_found),
 * so titles failed. The choice now comes from the account's own discovered model list
 * (codex `models_cache.json` / `model/list`, fetched by Codex itself from chatgpt.com):
 *
 *  1. the preferred model, when the account lists it (API-key style accounts keep mini);
 *  2. otherwise the account's first listed model (Codex picker order), which is the
 *     model the user can already chat with;
 *  3. nothing discovered yet → undefined, and the caller keeps its built-in default.
 *
 * Models the user switched off in Settings are skipped.
 */

import { isModelDisabled, type CatalogModel } from '@cindy/model-providers';

import { getDiscoveredCodexModels } from './active-catalog.js';
import { readModelDisableOverrides } from './model-disable-store.js';

/** Upstream's built-in Codex one-shot model (maker-core CodexAgent.oneShot default). */
export const CODEX_BUILTIN_ONESHOT_MODEL = 'gpt-5.4-mini';

/** The catalog provider whose Codex models come from the ChatGPT-login discovery. */
const CODEX_ACCOUNT_PROVIDER_ID = 'openai';

/**
 * Pure choice over an account model list. Returns undefined when the list is empty,
 * so callers can tell "no list yet" from "list without the preferred model".
 */
export function pickCodexOneShotModel(
  listed: readonly CatalogModel[],
  options: { preferred?: string; isDisabled?: (modelId: string) => boolean } = {},
): string | undefined {
  const preferred = options.preferred ?? CODEX_BUILTIN_ONESHOT_MODEL;
  const usable = listed.filter((model) => !options.isDisabled?.(model.id));
  if (usable.length === 0) {
    return undefined;
  }
  if (usable.some((model) => model.id === preferred)) {
    return preferred;
  }
  const rank = (model: CatalogModel): number => model.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const ordered = [...usable].sort((a, b) => rank(a) - rank(b));
  return ordered[0]?.id;
}

/**
 * Whether the signed-in account lists `modelId`. Null when no account list has been
 * discovered yet (unknown, so callers keep upstream behaviour).
 */
export function isCodexModelListedForAccount(
  modelId: string,
  listed: readonly CatalogModel[] = getDiscoveredCodexModels(),
): boolean | null {
  if (listed.length === 0) {
    return null;
  }
  return listed.some((model) => model.id === modelId);
}

/** The model a Codex one-shot without an explicit model should use right now. */
export function resolveCodexOneShotModel(): string | undefined {
  const overrides = readModelDisableOverrides();
  return pickCodexOneShotModel(getDiscoveredCodexModels(), {
    isDisabled: (modelId) => isModelDisabled(overrides, CODEX_ACCOUNT_PROVIDER_ID, modelId),
  });
}
