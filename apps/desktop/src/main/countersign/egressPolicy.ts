/**
 * Countersign egress policy: which hosts are never contacted, how a refused
 * request fails, and what the optional egress log records. Pure (no Electron)
 * so any main-process network choke point can import it.
 */
import fs from 'node:fs';

import { LOCAL_ONLY, LocalOnlyError } from '@cindy/maker-shared/local-only';

/** Hosts (and all their subdomains) that Countersign never contacts. */
export const BLOCKED_HOST_SUFFIXES: readonly string[] = [
  'cindy.app',
  'cindy.cn',
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

/**
 * What the egress log may hold: protocol and host only. Never a path, query,
 * fragment or userinfo (they can carry OAuth codes, signatures or tokens).
 */
export interface EgressEntry {
  protocol: string;
  host: string;
  blocked: boolean;
}

export interface EgressRecorder {
  record(entry: EgressEntry): void;
}

export const NO_RECORD: EgressRecorder = { record: () => {} };

/** Same protocol + host + blocked state is written at most once per window. */
export const EGRESS_LOG_DEDUPE_MS = 60_000;

/**
 * JSON-lines recorder: `{time, protocol, host, blocked}`, at most one line per
 * protocol+host+blocked state per `EGRESS_LOG_DEDUPE_MS`.
 */
export function createFileRecorder(
  logFile: string,
  now: () => number = Date.now,
): EgressRecorder {
  const lastWritten = new Map<string, number>();
  return {
    record(entry) {
      const key = `${entry.protocol}|${entry.host}|${entry.blocked}`;
      const at = now();
      const previous = lastWritten.get(key);
      if (previous !== undefined && at - previous < EGRESS_LOG_DEDUPE_MS) return;
      lastWritten.set(key, at);
      const line = JSON.stringify({
        time: new Date(at).toISOString(),
        protocol: entry.protocol,
        host: entry.host,
        blocked: entry.blocked,
      });
      try {
        fs.appendFileSync(logFile, `${line}\n`);
      } catch {
        // Logging is a diagnostic aid; a full disk must not break requests.
      }
    },
  };
}

let activeRecorder: EgressRecorder = NO_RECORD;

/** Set by `installEgressGuard`; choke points record through it. */
export function setEgressRecorder(recorder: EgressRecorder): void {
  activeRecorder = recorder;
}

export function getEgressRecorder(): EgressRecorder {
  return activeRecorder;
}

export interface EgressTarget {
  protocol: string;
  host: string;
}

export function targetFromUrl(raw: string | URL): EgressTarget | null {
  try {
    const url = raw instanceof URL ? raw : new URL(raw);
    if (!url.hostname) return null;
    return { protocol: url.protocol, host: url.hostname.replace(/^\[|\]$/g, '') };
  } catch {
    return null;
  }
}

export function blockedError(host: string): LocalOnlyError {
  return new LocalOnlyError(`Network access to ${host}`);
}

/**
 * Records the target and returns it when the request must be refused.
 * Never refuses when `LOCAL_ONLY` is off.
 */
export function checkEgressTarget(
  target: EgressTarget | null,
  recorder: EgressRecorder = activeRecorder,
): EgressTarget | null {
  if (!target) return null;
  const blocked = LOCAL_ONLY && isBlockedHost(target.host);
  recorder.record({ protocol: target.protocol, host: target.host, blocked });
  return blocked ? target : null;
}

/**
 * Explicit choke-point check for code that does not go through a wrapped
 * function (npm `undici` is bundled into the main build, so it cannot be
 * patched from outside): throws `LocalOnlyError` for a blocked host.
 */
export function assertEgressAllowed(url: string | URL): void {
  const refused = checkEgressTarget(targetFromUrl(url));
  if (refused) throw blockedError(refused.host);
}
