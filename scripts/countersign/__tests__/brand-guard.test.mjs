import assert from 'node:assert/strict';
import test from 'node:test';

import { findBrandLeaks } from '../brand-guard.mjs';

const LOCALE = 'apps/desktop/src/renderer/i18n/locales/en/common.json';

test('flags a locale string value that names Cindy, with its line', () => {
  const text = '{\n  "a": "ok",\n  "open": "Open Cindy settings"\n}\n';
  const leaks = findBrandLeaks([{ path: LOCALE, text }]);
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].path, LOCALE);
  assert.equal(leaks[0].line, 3);
  assert.equal(leaks[0].match, 'Cindy');
});

test('does not flag the appName placeholder', () => {
  const text = '{\n  "open": "Open {{appName}} settings"\n}\n';
  assert.deepEqual(findBrandLeaks([{ path: LOCALE, text }]), []);
});

test('never scans legal and fork-record files', () => {
  const text = 'Cindy is a trademark';
  const paths = [
    'LICENSE',
    'NOTICE',
    'docs/legal/notices/a.json',
    'FORK-CHANGES.md',
    'docs/countersign/plan.md',
  ];
  const leaks = findBrandLeaks(paths.map((path) => ({ path, text })));
  assert.deepEqual(leaks, []);
});

test('flags a literal Cindy title in desktop source', () => {
  const text = "const w = {\n  title: 'Cindy',\n};\n";
  const leaks = findBrandLeaks([{ path: 'apps/desktop/src/main/x.ts', text }]);
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].line, 2);
});

test('does not flag identifiers named after cindy', () => {
  const text = "const cindyDir = path.join(home, '.cindy');\n";
  assert.deepEqual(findBrandLeaks([{ path: 'apps/desktop/src/main/x.ts', text }]), []);
});

test('ignores a title that does not contain Cindy', () => {
  const text = 'title: BRAND_NAME,\n';
  assert.deepEqual(findBrandLeaks([{ path: 'apps/desktop/src/main/x.tsx', text }]), []);
});

test('flags a name that follows an escaped newline in a locale value', () => {
  const text = '{\n  "a": "Line one\\nCindy x"\n}\n';
  const leaks = findBrandLeaks([{ path: LOCALE, text }]);
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].line, 2);
});

test('flags the plural Cindys in a locale value', () => {
  const text = '{\n  "a": "Merge 3 Cindys into one?"\n}\n';
  assert.equal(findBrandLeaks([{ path: LOCALE, text }]).length, 1);
});

const HELP = 'apps/desktop/help-knowledge/getting-started.md';

test('flags the name in help prose', () => {
  const text = '---\ntitle: Getting started with Cindy\n---\nCindy is an app.\n';
  assert.equal(findBrandLeaks([{ path: HELP, text }]).length, 2);
});

test('ignores code spans, fences, link targets in help and the generated module', () => {
  const text = 'Run `/cindy-skill-creator` or Cindy-free.\n```\nCindy\n```\n[doc](docs/Cindy.md)\n';
  const leaks = findBrandLeaks([
    { path: HELP, text },
    { path: 'apps/desktop/src/main/maker-ipc/helpKnowledge.generated.ts', text: 'title: "Cindy"' },
  ]);
  // "Cindy-free" is a word-boundary hit on purpose; only that one line is reported.
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].line, 1);
});
