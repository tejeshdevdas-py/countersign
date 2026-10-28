import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ALLOWLIST,
  checkEgressImports,
  findUndiciReferences,
  isScannedPath,
  main,
} from '../egress-imports-check.mjs';

// In-memory fixtures only: this test never reads repository source.
const MAIN = 'apps/desktop/src/main';

function file(name, lines) {
  return { path: `${MAIN}/${name}`, text: `${lines.join('\n')}\n` };
}

test('a value import of undici without the assert is flagged, with its line', () => {
  const f = file('net/client.ts', [
    "import { log } from '../log';",
    "import { fetch as undiciFetch } from 'undici';",
    'export const get = (url: string) => undiciFetch(url);',
  ]);
  const result = checkEgressImports([f], new Map());
  assert.deepEqual(result.unguarded, [{ path: `${MAIN}/net/client.ts`, lines: [2] }]);
});

test('the same file passes once it calls assertEgressAllowed', () => {
  const f = file('net/client.ts', [
    "import { fetch as undiciFetch } from 'undici';",
    "import { assertEgressAllowed } from '../countersign/egressGuard';",
    'export const get = (url: string) => {',
    '  assertEgressAllowed(url);',
    '  return undiciFetch(url);',
    '};',
  ]);
  const result = checkEgressImports([f], new Map());
  assert.deepEqual(result.unguarded, []);
  assert.deepEqual(result.guarded, [`${MAIN}/net/client.ts`]);
});

test('type-only imports and exports do not count', () => {
  const text = [
    "import type { Agent } from 'undici';",
    "export type { Dispatcher } from 'undici';",
    "import type * as U from 'undici/types';",
  ].join('\n');
  assert.deepEqual(findUndiciReferences(`${MAIN}/a.ts`, text), []);
});

test('every way of loading undici counts, subpaths included', () => {
  const text = [
    "import 'undici';",
    "import { Agent } from 'undici';",
    "import * as undici from 'undici/index.js';",
    "export { fetch } from 'undici';",
    "export * from 'undici';",
    "import u = require('undici');",
    "const a = require('undici');",
    "const b = createRequire(import.meta.url)('undici');",
    "const c = await import('undici');",
    'const d = require(`undici`);',
    "import { type Pool } from 'undici';",
  ].join('\n');
  assert.deepEqual(findUndiciReferences(`${MAIN}/a.ts`, text), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('a require function bound to a name, and module.require, count too', () => {
  const text = [
    "import { createRequire } from 'node:module';",
    'const moduleRequire = createRequire(import.meta.url);',
    "const a = moduleRequire('undici');",
    'let workerRequire;',
    'workerRequire = module.createRequire(__filename);',
    "const b = workerRequire('undici/lib');",
    "const c = module.require('undici');",
    "const d = moduleRequire('ws');",
  ].join('\n');
  assert.deepEqual(findUndiciReferences(`${MAIN}/a.ts`, text), [3, 6, 7]);
});

test('only a call to assertEgressAllowed guards a file, not the name in a comment or string', () => {
  const lines = (extra) => ["import { request } from 'undici';", ...extra, 'request(target);'];
  const files = [
    file('comment.ts', lines(['// TODO: call assertEgressAllowed() before request'])),
    file('string.ts', lines(["const note = 'assertEgressAllowed(';"])),
    file('called.ts', lines(['assertEgressAllowed(target);'])),
  ];
  const result = checkEgressImports(files, new Map());
  assert.deepEqual(
    result.unguarded.map((u) => u.path),
    [`${MAIN}/comment.ts`, `${MAIN}/string.ts`],
  );
  assert.deepEqual(result.guarded, [`${MAIN}/called.ts`]);
});

test('the word undici in a string, a comment or another module name does not count', () => {
  const text = [
    "export const transport = { name: 'undici' as const };",
    '// undici is bundled',
    "import { x } from 'undici-types-extra';",
    "import { y } from './undici';",
  ].join('\n');
  assert.deepEqual(findUndiciReferences(`${MAIN}/a.ts`, text), []);
});

test('tests and files outside apps/desktop/src/main are not scanned', () => {
  assert.equal(isScannedPath(`${MAIN}/a.ts`), true);
  assert.equal(isScannedPath(`${MAIN}/ui/a.tsx`), true);
  assert.equal(isScannedPath(`${MAIN}/__tests__/a.ts`), false);
  assert.equal(isScannedPath(`${MAIN}/a.test.ts`), false);
  assert.equal(isScannedPath(`${MAIN}/a.spec.tsx`), false);
  assert.equal(isScannedPath(`${MAIN}/types.d.ts`), false);
  assert.equal(isScannedPath('apps/desktop/src/renderer/a.ts'), false);
  assert.equal(isScannedPath('packages/opencli-vendor/src/node-network.ts'), false);
  const outside = { path: 'packages/x/src/a.ts', text: "import { fetch } from 'undici';\n" };
  const inTest = { path: `${MAIN}/__tests__/a.ts`, text: "import { fetch } from 'undici';\n" };
  assert.deepEqual(checkEgressImports([outside, inTest], new Map()).unguarded, []);
});

test('an allowlisted file passes; stale entries fail', () => {
  const allowlist = new Map([
    [`${MAIN}/pool.ts`, 'constructs pools only'],
    [`${MAIN}/gone.ts`, 'used to load undici'],
    [`${MAIN}/fixed.ts`, 'used to skip the assert'],
  ]);
  const files = [
    file('pool.ts', ["import { Agent } from 'undici';", 'export const pool = new Agent();']),
    file('gone.ts', ['export const x = 1;']),
    file('fixed.ts', [
      "import { request } from 'undici';",
      'assertEgressAllowed(target);',
      'request(target);',
    ]),
  ];
  const result = checkEgressImports(files, allowlist);
  assert.deepEqual(result.unguarded, []);
  assert.deepEqual(result.stale, [
    { path: `${MAIN}/gone.ts`, why: 'no longer loads undici' },
    { path: `${MAIN}/fixed.ts`, why: 'now calls assertEgressAllowed itself' },
  ]);
});

test('the committed allowlist has two entries, each with a reason', () => {
  assert.deepEqual([...ALLOWLIST.keys()].sort(), [
    `${MAIN}/maker-host/title-one-shot.ts`,
    `${MAIN}/voice-input/refinerHttpDispatcher.ts`,
  ]);
  for (const reason of ALLOWLIST.values()) {
    assert.ok(reason.trim().length > 20);
  }
});

test('main: exit 0 when guarded, 1 when not, 2 when the folder is missing', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-egress-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const messages = [];
  const sink = { log: (l) => messages.push(l), error: (l) => messages.push(l) };
  assert.equal(main({ root, allowlist: new Map(), ...sink }), 2);

  const dir = path.join(root, 'apps', 'desktop', 'src', 'main', 'net');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'client.ts');
  fs.writeFileSync(
    target,
    "import { request } from 'undici';\nassertEgressAllowed(u);\nrequest(u);\n",
  );
  assert.equal(main({ root, allowlist: new Map(), ...sink }), 0);
  assert.match(messages.at(-1), /ok \(1 files scanned; 1 load undici and assert, 0 allowlisted\)/);

  fs.writeFileSync(target, "import { request } from 'undici';\nrequest(u);\n");
  assert.equal(main({ root, allowlist: new Map(), ...sink }), 1);
  assert.ok(
    messages.some((m) => m.startsWith('apps/desktop/src/main/net/client.ts:1: loads undici')),
  );
});
