/**
 * Countersign: the proxy path of outboundFetch (npm undici with its own
 * dispatcher, which the global-fetch wrapper never sees) still refuses
 * blocked hosts, including on a redirect hop, and lets provider hosts through.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalOnlyError } from '@cindy/maker-shared/local-only';

const resolverState = vi.hoisted(() => ({
  resolve: vi.fn<(url: string) => Promise<string | null>>(async () => null),
}));

const undiciState = vi.hoisted(() => ({
  fetch: vi.fn(async (..._args: unknown[]) => ({ ok: true, status: 200, headers: new Headers(), body: null })),
}));

vi.mock('../logger-adapter.js', () => ({
  createMakerLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
    isDebugEnabled: () => false,
  }),
}));

vi.mock('../outbound-proxy-resolver.js', () => ({
  resolveDesktopOutboundProxy: (url: string) => resolverState.resolve(url),
}));

vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, fetch: (...args: unknown[]) => undiciState.fetch(...args) };
});

import {
  guardedOutboundFetch,
  outboundFetch,
  outboundUndiciFetch,
  resetOutboundFetchStateForTest,
} from '../outbound-fetch.js';
import { setEgressRecorder, NO_RECORD, type EgressEntry } from '../../countersign/egressPolicy.js';

const recorded: EgressEntry[] = [];

beforeEach(() => {
  // Every request below would go through a system proxy.
  resolverState.resolve.mockReset();
  resolverState.resolve.mockResolvedValue('http://127.0.0.1:7890');
  undiciState.fetch.mockReset();
  undiciState.fetch.mockResolvedValue({ ok: true, status: 200, headers: new Headers(), body: null });
  recorded.length = 0;
  setEgressRecorder({ record: (entry) => recorded.push(entry) });
  resetOutboundFetchStateForTest();
});

afterEach(() => {
  setEgressRecorder(NO_RECORD);
  resetOutboundFetchStateForTest();
});

describe('outbound-fetch egress choke point behind a proxy', () => {
  it('refuses a blocked host before proxy resolution or any undici call', async () => {
    await expect(outboundFetch('https://hotfix.cindy.app/manifest.json')).rejects.toBeInstanceOf(LocalOnlyError);
    await expect(outboundUndiciFetch('https://e.tapdb.com/v1/event')).rejects.toBeInstanceOf(LocalOnlyError);
    expect(resolverState.resolve).not.toHaveBeenCalled();
    expect(undiciState.fetch).not.toHaveBeenCalled();
    expect(recorded).toEqual([
      { protocol: 'https:', host: 'hotfix.cindy.app', blocked: true },
      { protocol: 'https:', host: 'e.tapdb.com', blocked: true },
    ]);
  });

  it('lets a model-provider host through the proxy dispatcher', async () => {
    await outboundFetch('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{}' });
    expect(resolverState.resolve).toHaveBeenCalled();
    expect(undiciState.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = undiciState.fetch.mock.calls[0] as [string, { dispatcher?: unknown }];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.dispatcher).toBeDefined();
    expect(recorded).toContainEqual({ protocol: 'https:', host: 'api.anthropic.com', blocked: false });
  });

  it('refuses a redirect hop to a blocked host', async () => {
    undiciState.fetch.mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: new Headers({ location: 'https://auth.cindy.app/callback' }),
      body: { cancel: async () => undefined },
    } as never);
    await expect(outboundFetch('https://chatgpt.com/start')).rejects.toBeInstanceOf(LocalOnlyError);
    expect(undiciState.fetch).toHaveBeenCalledTimes(1);
  });

  it('guardedOutboundFetch refuses a blocked host', async () => {
    await expect(
      guardedOutboundFetch('https://p.cn-hangzhou.log.aliyuncs.com/logstores', {}, () => undefined),
    ).rejects.toBeInstanceOf(LocalOnlyError);
    expect(undiciState.fetch).not.toHaveBeenCalled();
  });
});
