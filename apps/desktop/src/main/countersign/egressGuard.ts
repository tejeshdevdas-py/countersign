/**
 * Countersign egress guard: keeps requests away from upstream's cloud,
 * telemetry and log hosts (`BLOCKED_HOST_SUFFIXES` in egressPolicy.ts).
 *
 * Covered:
 * - Renderer, webview and partition traffic: `webRequest.onBeforeRequest` on
 *   the default session and on every session the app creates. An app-installed
 *   `onBeforeRequest` listener (Electron allows one per session) is composed
 *   behind the guard instead of replacing it.
 * - Main process, wrapped here: `globalThis.fetch`, Electron `net.request` /
 *   `net.fetch`, Node `http(s).request` / `http(s).get` (so also `ws`).
 * - Main process, explicit checks (`assertEgressAllowed`): npm `undici` is
 *   bundled into the main build, so its functions cannot be patched from
 *   outside. Every first-party undici call site checks first:
 *   `maker-host/outbound-fetch.ts` (`outboundFetch`, `outboundUndiciFetch`,
 *   `guardedOutboundFetch`, and every redirect hop of the proxy path; this is
 *   the proxy path ~40 callers use), `cindy-brain/mobilePreview.ts`,
 *   `maker-host/title-one-shot.ts`, `plugin-publisher/putObject.ts`,
 *   `voice-input/LiteLlmTextModelClient.ts`,
 *   `voice-input/CodexResponsesTextModelClient.ts`.
 *
 * Not covered: raw sockets (`net.connect`, `tls.connect`); undici or fetch
 * copies inside workspace packages that call it directly
 * (`browser-control-runtime` SSRF helpers beyond `guardedOutboundFetch`'s own
 * check, `opencli-vendor`); a library that kept its own reference to a wrapped
 * function before the guard was installed; child processes (agent CLIs, git).
 * The endpoint getters fail closed independently of this guard.
 *
 * `COUNTERSIGN_EGRESS_LOG=<path>` writes JSON lines `{time, protocol, host,
 * blocked}` (no path, query or credentials), at most one line per
 * protocol+host+blocked state per minute. Unset means no log.
 */
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';

import { app, net, session } from 'electron';

import {
  blockedError,
  checkEgressTarget,
  createFileRecorder,
  getEgressRecorder,
  NO_RECORD,
  setEgressRecorder,
  targetFromUrl,
  type EgressRecorder,
  type EgressTarget,
} from './egressPolicy.js';

export {
  assertEgressAllowed,
  BLOCKED_HOST_SUFFIXES,
  createFileRecorder,
  EGRESS_LOG_DEDUPE_MS,
  isBlockedHost,
  type EgressEntry,
  type EgressRecorder,
} from './egressPolicy.js';

function stripPort(host: string): string {
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']'));
  const colon = host.lastIndexOf(':');
  return colon > 0 && host.indexOf(':') === colon ? host.slice(0, colon) : host;
}

/** Protocol and host of a `fetch`, `net.request` or `http(s).request` call. */
export function hostFromRequestArgs(args: readonly unknown[]): EgressTarget | null {
  const first = args[0];
  if (typeof first === 'string' || first instanceof URL) return targetFromUrl(first);
  if (typeof Request !== 'undefined' && first instanceof Request) return targetFromUrl(first.url);
  if (first && typeof first === 'object') {
    const options = first as { url?: unknown; hostname?: unknown; host?: unknown; protocol?: unknown };
    if (typeof options.url === 'string') return targetFromUrl(options.url);
    const rawHost =
      typeof options.hostname === 'string'
        ? options.hostname
        : typeof options.host === 'string'
          ? stripPort(options.host)
          : null;
    if (!rawHost) return null;
    const protocol = typeof options.protocol === 'string' ? options.protocol : 'https:';
    return { protocol, host: rawHost };
  }
  return null;
}

export function guardFetch<F extends (...args: never[]) => Promise<unknown>>(
  original: F,
  recorder?: EgressRecorder,
): F {
  const guarded = function (this: unknown, ...args: Parameters<F>) {
    const refused = checkEgressTarget(hostFromRequestArgs(args), recorder ?? getEgressRecorder());
    if (refused) return Promise.reject(blockedError(refused.host));
    return original.apply(this, args);
  };
  return guarded as unknown as F;
}

export function guardRequestFunction<F extends (...args: never[]) => unknown>(
  original: F,
  recorder?: EgressRecorder,
): F {
  const guarded = function (this: unknown, ...args: Parameters<F>) {
    const refused = checkEgressTarget(hostFromRequestArgs(args), recorder ?? getEgressRecorder());
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

const NETWORK_PROTOCOL = /^(https?|wss?):$/;
const guardedWebRequests = new WeakSet<object>();

/**
 * Installs the guard on one session's `webRequest` and keeps it in front of
 * any listener the app installs later on the same session.
 */
export function guardWebRequest(webRequest: WebRequestLike, recorder?: EgressRecorder): void {
  if (guardedWebRequests.has(webRequest)) return;
  guardedWebRequests.add(webRequest);
  const original = webRequest.onBeforeRequest.bind(webRequest);

  const install = (appListener: BeforeRequestListener | null, patterns: RegExp[] | null) => {
    original((details: { url: string }, callback: BeforeRequestCallback) => {
      const target = targetFromUrl(details.url);
      if (target && NETWORK_PROTOCOL.test(target.protocol)) {
        if (checkEgressTarget(target, recorder ?? getEgressRecorder())) {
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
  setEgressRecorder(opts.logFile ? createFileRecorder(opts.logFile) : NO_RECORD);

  if (typeof globalThis.fetch === 'function') {
    globalThis.fetch = guardFetch(globalThis.fetch.bind(globalThis));
  }
  const electronNet = net as unknown as Record<string, unknown>;
  for (const name of ['request', 'fetch'] as const) {
    const fn = electronNet[name];
    if (typeof fn !== 'function') continue;
    const bound = (fn as (...args: never[]) => unknown).bind(net);
    try {
      electronNet[name] =
        name === 'fetch'
          ? guardFetch(bound as (...args: never[]) => Promise<unknown>)
          : guardRequestFunction(bound);
    } catch {
      // A read-only property stays covered by the session webRequest guard.
    }
  }
  for (const mod of [http, https] as unknown as Array<Record<string, unknown>>) {
    for (const name of ['request', 'get'] as const) {
      const fn = mod[name];
      if (typeof fn === 'function') {
        mod[name] = guardRequestFunction(fn as (...args: never[]) => unknown);
      }
    }
  }
  syncBuiltinESMExports();

  // Registered before ready, so every session (including the default one)
  // passes through here; the whenReady branch covers a late install.
  app.on('session-created', (created) => {
    guardWebRequest(created.webRequest as unknown as WebRequestLike);
  });
  const guardDefault = () => {
    guardWebRequest(session.defaultSession.webRequest as unknown as WebRequestLike);
  };
  if (app.isReady()) guardDefault();
  else void app.whenReady().then(guardDefault);
}
