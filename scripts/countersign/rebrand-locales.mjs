/**
 * One-off: replace the Latin word "Cindy" with the {{appName}} placeholder in
 * every locale JSON string value. Keys are untouched and the files are edited
 * line by line, so formatting and line endings stay byte-identical elsewhere.
 * {{appName}} is a global i18n default (see renderer/i18n/index.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const localesDir = path.join(root, 'apps', 'desktop', 'src', 'renderer', 'i18n', 'locales');
const OLD_NAME = /\bCindy\b/g;
const KEY_PREFIX = /^(\s*"(?:[^"\x5c]|\x5c.)*"\s*:\s*)([^]*)$/;

for (const locale of fs.readdirSync(localesDir)) {
  const dir = path.join(localesDir, locale);
  if (!fs.statSync(dir).isDirectory()) {
    continue;
  }
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const file = path.join(dir, name);
    let count = 0;
    const swap = (text) =>
      text.replace(OLD_NAME, () => {
        count += 1;
        return '{{appName}}';
      });
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const next = lines.map((line) => {
      const m = KEY_PREFIX.exec(line);
      return m ? m[1] + swap(m[2]) : swap(line);
    });
    if (count > 0) {
      fs.writeFileSync(file, next.join('\n'));
    }
    console.log(`${locale}/${name}: ${count} replaced`);
  }
}
