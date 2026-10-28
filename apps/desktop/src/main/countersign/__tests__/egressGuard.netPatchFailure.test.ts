// Countersign (final review M-N6): when Electron's net.request or net.fetch
// cannot be replaced, the guard says so: one warning and one egress-log line
// per function, which the egress report does not pass. The session webRequest
// guard still covers renderer traffic, but main-process calls through that
// function are not checked.

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { summarizeEgress } from '../../../../../../scripts/countersign/egress-report.mjs';

vi.mock('electron', () => {
  // Getter-only properties: assigning a wrapper throws in strict mode, as a
  // read-only export would.
  const net = {};
  for (const name of ['request', 'fetch']) {
    Object.defineProperty(net, name, {
      enumerable: true,
      get: () => () => `net-${name}`,
    });
  }
  return {
    app: { on: () => {}, isReady: () => true, whenReady: () => Promise.resolve() },
    net,
    session: { defaultSession: { webRequest: { onBeforeRequest: () => {} } } },
  };
});

const originals = {
  fetch: globalThis.fetch,
  httpRequest: http.request,
  httpGet: http.get,
  httpsRequest: https.request,
  httpsGet: https.get,
};
const dirs: string[] = [];

afterAll(() => {
  globalThis.fetch = originals.fetch;
  http.request = originals.httpRequest;
  http.get = originals.httpGet;
  https.request = originals.httpsRequest;
  https.get = originals.httpsGet;
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('installEgressGuard when net cannot be patched', () => {
  it('warns and writes one egress-log line per unwrapped function', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-egress-patch-'));
    dirs.push(dir);
    const logFile = path.join(dir, 'egress.jsonl');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { installEgressGuard } = await import('../egressGuard');
    installEgressGuard({ logFile });

    const warnings = warn.mock.calls.map((call) => String(call[0]));
    expect(warnings.filter((text) => text.includes('net.request'))).toHaveLength(1);
    expect(warnings.filter((text) => text.includes('net.fetch'))).toHaveLength(1);

    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      { time: expect.any(String), guard: 'net.request', installed: false },
      { time: expect.any(String), guard: 'net.fetch', installed: false },
    ]);
    // The egress report counts these lines against the log, so it cannot pass.
    expect(summarizeEgress(lines).malformed).toBe(2);
  });
});
