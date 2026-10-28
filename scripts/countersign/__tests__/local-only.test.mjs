/**
 * Countersign: build scripts read the one LOCAL_ONLY switch
 * (packages/maker-shared/src/localOnly.ts) instead of keeping their own copy.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { readLocalOnlySwitch } from '../local-only.mjs';

const temps = [];

afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function repoWithSwitch(text) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-local-only-'));
  temps.push(root);
  const file = path.join(root, 'packages', 'maker-shared', 'src', 'localOnly.ts');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (text !== null) fs.writeFileSync(file, text);
  return root;
}

test('reads true from this repository', () => {
  assert.equal(readLocalOnlySwitch(), true);
});

test('reads the declared value, with or without CRLF line endings', () => {
  assert.equal(
    readLocalOnlySwitch(repoWithSwitch('export const LOCAL_ONLY = false as const;\n')),
    false,
  );
  assert.equal(
    readLocalOnlySwitch(repoWithSwitch('/** x */\r\nexport const LOCAL_ONLY = true as const;\r\n')),
    true,
  );
});

test('fails when the switch cannot be read, rather than guessing', () => {
  assert.throws(() => readLocalOnlySwitch(repoWithSwitch(null)), /LOCAL_ONLY/);
  assert.throws(
    () => readLocalOnlySwitch(repoWithSwitch('export const LOCAL_ONLY = process.env.X === "1";\n')),
    /LOCAL_ONLY/,
  );
  assert.throws(
    () =>
      readLocalOnlySwitch(
        repoWithSwitch(
          'export const LOCAL_ONLY = true as const;\nexport const LOCAL_ONLY = false as const;\n',
        ),
      ),
    /LOCAL_ONLY/,
  );
});
