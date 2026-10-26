/**
 * Countersign egress guard: the last line of defence that keeps every request
 * away from upstream's cloud, telemetry and log hosts, whatever code path
 * makes it.
 *
 * - Renderer, webview and partition traffic: `webRequest.onBeforeRequest` on
 *   the default session and on every session the app creates. An app-installed
 *   `onBeforeRequest` listener (Electron allows one per session) is composed
 *   behind the guard instead of replacing it.
 * - Main process: `globalThis.fetch`, Electron `net.request` / `net.fetch` and
 *   Node `http(s).request` / `http(s).get` throw `LocalOnlyError` for a blocked
 *   host.
 *
 * Not covered: raw sockets (`net.connect`, `tls.connect`), a library that kept
 * its own reference to one of these functions before the guard was installed,
 * and child processes. The endpoint getters fail closed independently.
 *
 * `COUNTERSIGN_EGRESS_LOG=<path>` appends one JSON line per outbound host
 * (`{time, host, url, blocked}`); unset means no log.
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';

import { LocalOnlyError } from '@cindy/maker-shared/local-only';
import { app, net, session } from 'electron';

/** Hosts (and all their subdomains) that Countersign never contacts. */
export const BLOCKED_HOST_SUFFIXES: readonly string[] = [
  'cindy.app',
  'cindy.com.cn',
  'tapdb.com',
  'tapapis.com',
  'log.aliyuncs.com',
];

export function isBlockedHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/\.+$/, '');
  if (!normalized) return false;
  return BLOCKED_HOST_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
}

export interface EgressEntry {
  host: string;
  url: string;
  blocked: boolean;
}

export interface EgressRecorder {
  record(entry: EgressEntry): void;
}

const NO_RECORD: EgressRecorder = { record: () => {} };

export function createFileRecorder(logFile: string): EgressRecorder {
  return {
    record(entry) {
      const line = JSON.stringify({ time: new Date().toISOString(), ...entry });
      try {
        fs.appendFileSync(logFile, `${line}\n`);
      } catch {
        // Logging is a diagnostic aid; a full disk must not break requests.
      }
    },
  };
}

interface Target {
  host: string;
  url: string;
}

function targetFromUrl(raw: string | URL): Target | null {
  try {
    const url = raw instanceof URL ? raw : new URL(raw);
    if (!url.hostname) return null;
    return { host: url.hostname.replace(/^\[|\]$/g, ''), url: url.href };
  } catch {
    return null;
  }
}

function stripPort(host: string): string {
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']'));
  const colon = host.lastIndexOf(':');
  return colon > 0 && host.indexOf(':') === colon ? host.slice(0, colon) : host;
}

/** Host and URL of a `fetch`, `net.request` or `http(s).request` call. */
export function hostFromRequestArgs(args: readonly unknown[]): Target | null {
  const first = args[0];
  if (typeof first === 'string' || first instanceof URL) return targetFromUrl(first);
  if (typeof Request !== 'undefined' && first instanceof Request) return targetFromUrl(first.url);
  if (first && typeof first === 'object') {
    const options = first as { url?: unknown; hostname?: unknown; host?: unknown; protocol?: unknown; path?: unknown };
    if (typeof options.url === 'string') return targetFromUrl(options.url);
    const rawHost =
      typeof options.hostname === 'string'
        ? options.hostname
        : typeof options.host === 'string'
          ? stripPort(options.host)
          : null;
    if (!rawHost) return null;
    const protocol = typeof options.protocol === 'string' ? options.protocol : 'https:';
    const pathPart = typeof options.path === 'string' ? options.path : '/';
    return { host: rawHost, url: `${protocol}//${rawHost}${pathPart}` };
  }
  return null;
}

function blockedError(host: string): LocalOnlyError {
  return new LocalOnlyError(`Network access to ${host}`);
}

/** Returns the target when the request must be refused, after recording it. */
function check(args: readonly unknown[], recorder: EgressRecorder): Target | null {
  const target = hostFromRequestArgs(args);
  if (!target) return null;
  const blocked = isBlockedHost(target.host);
  recorder.record({ host: target.host, url: target.url, blocked });
  return blocked ? target : null;
}

export function guardFetch<F extends (...args: never[]) => Promise<unknown>>(
  original: F,
  recorder: EgressRecorder = NO_RECORD,
): F {
  const guarded = function (this: unknown, ...args: Parameters<F>) {
    const refused = check(args, recorder);
    if (refused) return Promise.reject(blockedError(refused.host));
    return original.apply(this, args);
  };
  return guarded as unknown as F;
}

export function guardRequestFunction<F extends (...args: never[]) => unknown>(
  original: F,
  recorder: EgressRecorder = NO_RECORD,
): F {
  const guarded = function (this: unknown, ...args: Parameters<F>) {
    const refused = check(args, recorder);
    if (refused) throw blockedError(refused.host);
    return original.apply(this, args);
  };
  return guarded as unknown as F;
}

type BeforeRequestCallback = (response: { cancel?: boolean; redirectURL?: string }) => void;
type BeforeRequestListener = (details: { url: string }, callback: BeforeRequestCallback) => void;

interface WebRequestLike {
  onBeforeRequest(...args: unknown[]): void;
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const guardedWebRequests = new WeakSet<object>();

/**
 * Installs the guard on one session's `webRequest` and keeps it in front of
 * any listener the app installs later on the same session.
 */
export function guardWebRequest(webRequest: WebRequestLike, recorder: EgressRecorder = NO_RECORD): void {
  if (guardedWebRequests.has(webRequest)) return;
  guardedWebRequests.add(webRequest);
  const original = webRequest.onBeforeRequest.bind(webRequest);

  const install = (appListener: BeforeRequestListener | null, patterns: RegExp[] | null) => {
    original((details: { url: string }, callback: BeforeRequestCallback) => {
      const target = targetFromUrl(details.url);
      if (target && /^(https?|wss?):$/.test(new URL(target.url).protocol)) {
        const blocked = isBlockedHost(target.host);
        recorder.record({ host: target.host, url: target.url, blocked });
        if (blocked) {
          callback({ cancel: true });
          return;
        }
      }
      if (appListener && (!patterns || patterns.some((re) => re.test(details.url)))) {
        appListener(details, callback);
        return;
      }
      callback({});
    });
  };

  webRequest.onBeforeRequest = (...args: unknown[]) => {
    if (args.length >= 2) {
      const filter = args[0] as { urls?: string[] } | null;
      const urls = filter?.urls ?? [];
      install(args[1] as BeforeRequestListener | null, urls.length ? urls.map(patternToRegExp) : null);
      return;
    }
    install((args[0] as BeforeRequestListener | null) ?? null, null);
  };
  install(null, null);
}

let installed = false;

/**
 * Wires the guard into the main process and every Electron session. Call
 * once, before any endpoint, window or session is used.
 */
export function installEgressGuard(opts: { logFile: string | null }): void {
  if (installed) return;
  installed = true;
  const recorder = opts.logFile ? createFileRecorder(opts.logFile) : NO_RECORD;

  if (typeof globalThis.fetch === 'function') {
    globalThis.fetch = guardFetch(globalThis.fetch.bind(globalThis), recorder);
  }
  const electronNet = net as unknown as Record<string, unknown>;
  for (const name of ['request', 'fetch'] as const) {
    const fn = electronNet[name];
    if (typeof fn !== 'function') continue;
    const bound = (fn as (...args: never[]) => unknown).bind(net);
    try {
      electronNet[name] =
        name === 'fetch'
          ? guardFetch(bound as (...args: never[]) => Promise<unknown>, recorder)
          : guardRequestFunction(bound, recorder);
    } catch {
      // A read-only property stays covered by the session webRequest guard.
    }
  }
  for (const mod of [http, https] as unknown as Array<Record<string, unknown>>) {
    for (const name of ['request', 'get'] as const) {
      const fn = mod[name];
      if (typeof fn === 'function') {
        mod[name] = guardRequestFunction(fn as (...args: never[]) => unknown, recorder);
      }
    }
  }
  syncBuiltinESMExports();

  // Registered before ready, so every session (including the default one)
  // passes through here; the whenReady branch covers a late install.
  app.on('session-created', (created) => {
    guardWebRequest(created.webRequest as unknown as WebRequestLike, recorder);
  });
  const guardDefault = () => {
    guardWebRequest(session.defaultSession.webRequest as unknown as WebRequestLike, recorder);
  };
  if (app.isReady()) guardDefault();
  else void app.whenReady().then(guardDefault);
}
