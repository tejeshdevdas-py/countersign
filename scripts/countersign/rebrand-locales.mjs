/**
 * One-off: replace the product name "Cindy" (and the plural "Cindys") with the
 * {{appName}} placeholder in every locale JSON string value, and with the
 * literal product name in the in-app help prose (help-knowledge/*.md).
 * Keys are untouched and files are edited line by line, so formatting and line
 * endings stay byte-identical elsewhere. {{appName}} is a global i18n default
 * (see renderer/i18n/index.ts).
 *
 * In raw JSON text a name after an escaped newline reads "\nCindy" (no word
 * boundary), so the pattern also accepts a backslash escape before the name.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const localesDir = path.join(root, 'apps', 'desktop', 'src', 'renderer', 'i18n', 'locales');
const helpDir = path.join(root, 'apps', 'desktop', 'help-knowledge');
const PRODUCT_NAME = 'Countersign';
const JSON_NAME = /(?:\b|(?<=\x5c[nrt]))Cindy(s?)\b/g;
const HELP_NAME = /\bCindy\b/g;
const KEY_PREFIX = /^(\s*"(?:[^"\x5c]|\x5c.)*"\s*:\s*)([^]*)$/;

function pluralOf(token, offset, whole, singular) {
  // "Cindys" are several bots of the product: "{{appName}} bots".
  const before = whole.slice(0, offset);
  return /Duplicate $/.test(before) ? `${singular} Bots` : `${singular} bots`;
}

for (const locale of fs.readdirSync(localesDir)) {
  const dir = path.join(localesDir, locale);
  if (!fs.statSync(dir).isDirectory()) {
    continue;
  }
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const file = path.join(dir, name);
    let count = 0;
    const swap = (text) =>
      text.replace(JSON_NAME, (match, plural, offset, whole) => {
        count += 1;
        return plural ? pluralOf(match, offset, whole, '{{appName}}') : '{{appName}}';
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

// Help sources: prose only. Code spans (`...`) and fenced blocks are left alone.
for (const name of fs.readdirSync(helpDir).filter((f) => f.endsWith('.md'))) {
  const file = path.join(helpDir, name);
  let count = 0;
  let inFence = false;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const next = lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) {
      return line;
    }
    return line
      .split(/(`[^`]*`)/)
      .map((part) =>
        part.startsWith('`')
          ? part
          : part.replace(HELP_NAME, () => {
              count += 1;
              return PRODUCT_NAME;
            }),
      )
      .join('');
  });
  if (count > 0) {
    fs.writeFileSync(file, next.join('\n'));
  }
  console.log(`help-knowledge/${name}: ${count} replaced`);
}
