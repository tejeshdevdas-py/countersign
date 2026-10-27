import { describe, expect, it } from 'vitest';

import { isContextOverflowErrorMessage } from './context-overflow-error.js';

describe('Countersign: local-server context overflow', () => {
  it('recognises the LM Studio / llama.cpp refusal seen in the live run', () => {
    const message =
      'Engine protocol predict request returned 400: {"error":{"code":400,"message":"request (10849 tokens) exceeds the available context size (8192 tokens), try increasing it","type":"exceed_context_size_error","n_prompt_tokens":10849,"n_ctx":8192}}';
    expect(isContextOverflowErrorMessage(message)).toBe(true);
  });

  it('recognises the bare error type', () => {
    expect(isContextOverflowErrorMessage('{"type":"exceed_context_size_error"}')).toBe(true);
  });

  it('still ignores a token rate limit', () => {
    expect(isContextOverflowErrorMessage('too many tokens per minute')).toBe(false);
  });
});
