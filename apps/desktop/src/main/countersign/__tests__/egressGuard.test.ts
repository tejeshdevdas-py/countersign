import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => {
  const listeners: Record<string, (...args: unknown[]) => void> = {};
  const defaultState: {
    listener: ((details: { url: string }, callback: (r: { cancel?: boolean }) => void) => void) | null;
  } = { listener: null };
  const defaultWebRequest = {
    onBeforeRequest: (...args: unknown[]) => {
      defaultState.listener = args[args.length - 1] as typeof defaultState.listener;
    },
  };
  return {
    listeners,
    defaultState,
    defaultWebRequest,
    netRequest: (..._args: unknown[]) => 'net-request',
    netFetch: async (..._args: unknown[]) => 'net-fetch',
  };
});

vi.mock('electron', () => ({
  app: {
    on: (event: string, listener: (...args: unknown[]) => void) => {
      electronMock.listeners[event] = listener;
    },
    isReady: () => true,
    whenReady: () => Promise.resolve(),
  },
  net: { request: electronMock.netRequest, fetch: electronMock.netFetch },
  session: { defaultSession: { webRequest: electronMock.defaultWebRequest } },
}));

import { LocalOnlyError } from '@cindy/maker-shared/local-only';
import { net } from 'electron';

import {
  guardFetch,
  guardRequestFunction,
  guardWebRequest,
  hostFromRequestArgs,
  isBlockedHost,
  type EgressRecorder,
} from '../egressGuard';

describe('isBlockedHost', () => {
  it.each([
    'auth.cindy.app',
    'cindy.app',
    'x.cindy.com.cn',
    'e.tapdb.com',
    'e.tapdb.ap-sg.tapapis.com',
    'p.cn-hangzhou.log.aliyuncs.com',
    'hotfix.cindy.app',
    'HOTFIX.Cindy.App',
    'cindy.app.',
  ])('blocks %s', (host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it.each([
    'api.anthropic.com',
    'claude.ai',
    'chatgpt.com',
    'api.openai.com',
    'auth.openai.com',
    '127.0.0.1',
    'localhost',
    'github.com',
    'notcindy.app',
    'cindy.app.example.com',
    'aliyuncs.com',
    '',
  ])('allows %s', (host) => {
    expect(isBlockedHost(host)).toBe(false);
  });
});

function recorder(): EgressRecorder & { entries: Array<{ protocol: string; host: string; blocked: boolean }> } {
  const entries: Array<{ protocol: string; host: string; blocked: boolean }> = [];
  return {
    entries,
    record: (entry) => {
      entries.push(entry);
    },
  };
}

describe('hostFromRequestArgs', () => {
  it('reads string, URL and options forms', () => {
    expect(hostFromRequestArgs(['https://auth.cindy.app/x'])?.host).toBe('auth.cindy.app');
    expect(hostFromRequestArgs([new URL('http://localhost:3000/a')])?.host).toBe('localhost');
    expect(hostFromRequestArgs([{ hostname: 'e.tapdb.com', path: '/v1' }])?.host).toBe('e.tapdb.com');
    expect(hostFromRequestArgs([{ host: 'cindy.app:443' }])?.host).toBe('cindy.app');
    expect(hostFromRequestArgs([{ url: 'https://api.openai.com/v1' }])?.host).toBe('api.openai.com');
    expect(hostFromRequestArgs([])).toBeNull();
  });
});

describe('guardFetch', () => {
  it('rejects blocked hosts with LocalOnlyError and never calls the original', async () => {
    const original = vi.fn(async () => new Response('ok'));
    const rec = recorder();
    const guarded = guardFetch(original as unknown as typeof fetch, rec);
    await expect(guarded('https://hotfix.cindy.app/manifest.json')).rejects.toBeInstanceOf(LocalOnlyError);
    await expect(guarded('https://hotfix.cindy.app/manifest.json')).rejects.toThrow(
      'Network access to hotfix.cindy.app is not available in Countersign',
    );
    expect(original).not.toHaveBeenCalled();
    expect(rec.entries[0]).toMatchObject({ host: 'hotfix.cindy.app', blocked: true });
  });

  it('passes allowed hosts through and records them', async () => {
    const original = vi.fn(async () => new Response('ok'));
    const rec = recorder();
    const guarded = guardFetch(original as unknown as typeof fetch, rec);
    const request = new Request('https://api.anthropic.com/v1/messages');
    await guarded(request);
    expect(original).toHaveBeenCalledWith(request);
    expect(rec.entries).toEqual([
      { protocol: 'https:', host: 'api.anthropic.com', blocked: false },
    ]);
  });
});

describe('guardRequestFunction', () => {
  it('throws synchronously for blocked hosts and delegates the rest', () => {
    const original = vi.fn((..._args: unknown[]) => 'req');
    const rec = recorder();
    const guarded = guardRequestFunction(original, rec);
    expect(() => guarded({ hostname: 'p.cn-hangzhou.log.aliyuncs.com' })).toThrow(LocalOnlyError);
    expect(guarded('https://github.com/x', { method: 'GET' })).toBe('req');
    expect(original).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith('https://github.com/x', { method: 'GET' });
  });
});

type Listener = (details: { url: string }, callback: (response: { cancel?: boolean }) => void) => void;

function fakeWebRequest() {
  const state: { listener: Listener | null; filter: unknown } = { listener: null, filter: undefined };
  const webRequest = {
    onBeforeRequest(...args: unknown[]) {
      if (args.length === 2) {
        state.filter = args[0];
        state.listener = args[1] as Listener | null;
      } else {
        state.filter = undefined;
        state.listener = args[0] as Listener | null;
      }
    },
  };
  const send = (url: string) =>
    new Promise<{ cancel?: boolean }>((resolve) => {
      if (!state.listener) {
        resolve({});
        return;
      }
      state.listener({ url }, resolve);
    });
  return { webRequest, state, send };
}

describe('guardWebRequest', () => {
  it('cancels blocked hosts and allows the rest', async () => {
    const { webRequest, send } = fakeWebRequest();
    const rec = recorder();
    guardWebRequest(webRequest, rec);
    await expect(send('https://auth.cindy.app/login')).resolves.toEqual({ cancel: true });
    await expect(send('https://claude.ai/')).resolves.toEqual({});
    await expect(send('file:///C:/app/index.html')).resolves.toEqual({});
    expect(rec.entries.map((e) => e.host)).toEqual(['auth.cindy.app', 'claude.ai']);
  });

  it('keeps blocking after the app installs its own listener, and still runs that listener', async () => {
    const { webRequest, send } = fakeWebRequest();
    guardWebRequest(webRequest, recorder());
    const appListener = vi.fn<Listener>((_details, callback) => callback({ cancel: false }));
    webRequest.onBeforeRequest(appListener);
    await expect(send('https://e.tapdb.com/event')).resolves.toEqual({ cancel: true });
    expect(appListener).not.toHaveBeenCalled();
    await expect(send('https://api.openai.com/v1')).resolves.toEqual({ cancel: false });
    expect(appListener).toHaveBeenCalledTimes(1);
  });

  it('applies an app listener filter only to matching URLs', async () => {
    const { webRequest, send } = fakeWebRequest();
    guardWebRequest(webRequest, recorder());
    const appListener = vi.fn<Listener>((_details, callback) => callback({ cancel: true }));
    webRequest.onBeforeRequest({ urls: ['https://*.example.com/*'] }, appListener);
    await expect(send('https://a.example.com/x')).resolves.toEqual({ cancel: true });
    await expect(send('https://github.com/x')).resolves.toEqual({});
    expect(appListener).toHaveBeenCalledTimes(1);
  });

  it('removing the app listener leaves the guard in place', async () => {
    const { webRequest, send } = fakeWebRequest();
    guardWebRequest(webRequest, recorder());
    webRequest.onBeforeRequest(null);
    await expect(send('https://cindy.app/')).resolves.toEqual({ cancel: true });
  });
});

describe('file recorder', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes time, protocol, host and blocked only, once per host state per minute', async () => {
    const { createFileRecorder } = await import('../egressGuard');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-egress-'));
    dirs.push(dir);
    const logFile = path.join(dir, 'egress.jsonl');
    let clock = 1_000_000;
    const rec = createFileRecorder(logFile, () => clock);
    rec.record({ protocol: 'https:', host: 'cindy.app', blocked: true });
    rec.record({ protocol: 'https:', host: 'cindy.app', blocked: true });
    rec.record({ protocol: 'https:', host: 'github.com', blocked: false });
    clock += 60_000;
    rec.record({ protocol: 'https:', host: 'cindy.app', blocked: true });
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(lines).toHaveLength(3);
    expect(Object.keys(lines[0]).sort()).toEqual(['blocked', 'host', 'protocol', 'time']);
    expect(lines[0]).toMatchObject({ protocol: 'https:', host: 'cindy.app', blocked: true });
    expect(lines[1]).toMatchObject({ host: 'github.com', blocked: false });
  });

  it('never records path, query, fragment or userinfo from real requests', async () => {
    const { createFileRecorder } = await import('../egressGuard');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-egress-'));
    dirs.push(dir);
    const logFile = path.join(dir, 'egress.jsonl');
    const rec = createFileRecorder(logFile);
    const original = vi.fn(async () => new Response('ok'));
    const guarded = guardFetch(original as unknown as typeof fetch, rec);
    await guarded('https://user:pass@api.openai.com/oauth/callback?code=SECRET&state=XYZ#frag');
    await expect(
      guarded('https://auth.cindy.app/path/with/token123?sig=abc'),
    ).rejects.toBeInstanceOf(LocalOnlyError);
    const { webRequest, send } = fakeWebRequest();
    guardWebRequest(webRequest, rec);
    await send('https://bucket.example.com/upload/key?X-Amz-Signature=deadbeef');
    const text = fs.readFileSync(logFile, 'utf8');
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line).not.toContain('?');
      expect(line).not.toContain('@');
      expect(line).not.toMatch(/SECRET|pass|token123|deadbeef|frag|oauth|upload/);
      const entry = JSON.parse(line) as Record<string, string>;
      expect(entry.host).not.toContain('/');
    }
  });
});

describe('installEgressGuard wiring', () => {
  const originals = {
    fetch: globalThis.fetch,
    httpRequest: http.request,
    httpGet: http.get,
    httpsRequest: https.request,
    httpsGet: https.get,
  };
  afterAll(() => {
    globalThis.fetch = originals.fetch;
    http.request = originals.httpRequest;
    http.get = originals.httpGet;
    https.request = originals.httpsRequest;
    https.get = originals.httpsGet;
  });

  it('guards main-process fetch, net, http(s) and every session', async () => {
    const { installEgressGuard } = await import('../egressGuard');
    installEgressGuard({ logFile: null });

    await expect(globalThis.fetch('https://hotfix.cindy.app/x')).rejects.toBeInstanceOf(LocalOnlyError);
    expect(() => http.request('http://e.tapdb.com/x')).toThrow(LocalOnlyError);
    expect(() => http.get({ hostname: 'cindy.com.cn' })).toThrow(LocalOnlyError);
    expect(() => https.request({ host: 'auth.cindy.app:443', path: '/' })).toThrow(LocalOnlyError);
    expect(() => https.get('https://p.cn-hangzhou.log.aliyuncs.com/')).toThrow(LocalOnlyError);
    expect(() => (net.request as (url: string) => unknown)('https://cindy.app/')).toThrow(LocalOnlyError);
    await expect((net.fetch as (url: string) => Promise<unknown>)('https://cindy.app/')).rejects.toBeInstanceOf(
      LocalOnlyError,
    );
    expect((net.request as (url: string) => unknown)('https://github.com/')).toBe('net-request');

    const defaultSend = (url: string) =>
      new Promise<{ cancel?: boolean }>((resolve) => {
        electronMock.defaultState.listener!({ url }, resolve);
      });
    await expect(defaultSend('https://e.tapdb.ap-sg.tapapis.com/')).resolves.toEqual({ cancel: true });
    await expect(defaultSend('https://api.anthropic.com/')).resolves.toEqual({});

    expect(typeof electronMock.listeners['session-created']).toBe('function');
    const partition = fakeWebRequest();
    electronMock.listeners['session-created']!({ webRequest: partition.webRequest });
    await expect(partition.send('https://auth.cindy.app/')).resolves.toEqual({ cancel: true });
    await expect(partition.send('https://claude.ai/')).resolves.toEqual({});
  });
});
