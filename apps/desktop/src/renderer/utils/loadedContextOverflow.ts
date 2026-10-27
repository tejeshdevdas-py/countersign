/**
 * Countersign: a local model server (LM Studio, llama.cpp server) refuses a
 * request bigger than the context the model was loaded with, e.g.
 * `request (10849 tokens) exceeds the available context size (8192 tokens)`
 * with `"type":"exceed_context_size_error","n_prompt_tokens":10849,"n_ctx":8192`.
 * The fix is on the server side (raise the context length and reload), so the
 * banner names both numbers instead of a generic failure.
 */
export interface LoadedContextOverflow {
  requestTokens: number;
  loadedContextTokens: number;
}

const SENTENCE = /request \((\d+) tokens\) exceeds the available context size \((\d+) tokens\)/i;
// The body may arrive JSON-escaped inside another message (`\"n_ctx\":8192`).
const PROMPT_TOKENS = /\\?"n_prompt_tokens\\?"\s*:\s*(\d+)/;
const LOADED_CONTEXT = /\\?"n_ctx\\?"\s*:\s*(\d+)/;

export function parseLoadedContextOverflow(message: string | null | undefined): LoadedContextOverflow | null {
  if (!message) return null;
  const sentence = SENTENCE.exec(message);
  if (sentence) {
    return { requestTokens: Number(sentence[1]), loadedContextTokens: Number(sentence[2]) };
  }
  if (!/exceed_context_size_error/.test(message)) return null;
  const request = PROMPT_TOKENS.exec(message);
  const loaded = LOADED_CONTEXT.exec(message);
  if (!request || !loaded) return null;
  return { requestTokens: Number(request[1]), loadedContextTokens: Number(loaded[1]) };
}
