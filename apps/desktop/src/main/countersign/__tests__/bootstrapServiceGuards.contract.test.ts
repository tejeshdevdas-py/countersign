/**
 * Countersign guard contract (final review M-N7): bootstrap-electron.ts starts
 * each upstream background service only behind its isServiceDisabled guard.
 * Under LOCAL_ONLY every guard is true (services.test.ts), so analytics, log
 * upload, the updater and the heartbeat never start. bootstrap-electron.ts
 * cannot be imported in a unit test (it starts Electron), so this guard-tier
 * test pins the wiring in its source.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '..', '..', 'bootstrap-electron.ts'), 'utf8');

function count(text: string): number {
  return source.split(text).length - 1;
}

/** The call must be the first statement inside `if (!isServiceDisabled('<service>')) {`. */
function expectGuarded(call: string, service: string): void {
  expect(count(call), `${call} appears once`).toBe(1);
  const at = source.indexOf(call);
  const before = source.slice(0, at).trimEnd();
  const guard = `if (!isServiceDisabled('${service}')) {`;
  expect(before.endsWith(guard), `${call} sits directly inside ${guard}`).toBe(true);
}

describe('bootstrap upstream service guards in Countersign', () => {
  it('imports the guard from the fork services module', () => {
    expect(source).toContain("import { isServiceDisabled } from './countersign/services.js';");
  });

  it.each([
    ['initAnalyticsSettingsService();', 'analytics'],
    ['initLogUploadService();', 'logUpload'],
    ['initUpdateService();', 'updater'],
    ['initHeartbeatService();', 'heartbeat'],
  ])('%s runs only when %s is not disabled', (call, service) => {
    expectGuarded(call, service);
  });
});
