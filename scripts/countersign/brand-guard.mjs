/**
 * Brand guard: fails when the product's old name appears in text a user sees.
 *
 * Scans (1) the decoded string values of the desktop locale JSON files,
 * (2) literal window, dialog and notification titles in desktop .ts/.tsx source,
 * and (3) the prose of the in-app help sources (apps/desktop/help-knowledge/*.md,
 * outside code spans, code fences and link targets). Code identifiers and
 * internal log text may keep the old name and are not scanned.
 * LICENSE, NOTICE, docs/legal, FORK-CHANGES.md, docs/countersign and generated
 * files are exempt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The old name, also as a plural ("Cindys"). Tested on decoded text.
const OLD_NAME = /\bCindys?\b/;
const LOCALE_PATH = /^apps\/desktop\/src\/renderer\/i18n\/locales\/.+\.json$/;
const HELP_PATH = /^apps\/desktop\/help-knowledge\/[^/]+\.md$/;
const SOURCE_PATH = /^apps\/desktop\/src\/(?!.*(?:__tests__\/|\.test\.tsx?$)).+\.tsx?$/;
const EXEMPT = [
  /\.generated\.tsx?$/,
  /^LICENSE$/,
  /^NOTICE$/,
  /^docs\/legal\//,
  /^FORK-CHANGES\.md$/,
  /^docs\/countersign\//,
];

// A JSON line carrying a string value: `"key": "value"` or an array item `"value"`.
const JSON_VALUE = /^\s*(?:"(?:[^"\x5c]|\x5c.)*"\s*:\s*)?("(?:[^"\x5c]|\x5c.)*")\s*,?\s*$/;
// `title: '...'`, `title="..."`, `title={'...'}` and similar literal titles.
const TITLE_LITERAL = /\btitle\s*[:=]\s*\{?\s*(['"`])(.*?)\1/g;

function normalize(p) {
  return p.replace(/\x5c/g, '/');
}

function decodeJsonString(token) {
  try {
    return JSON.parse(token);
  } catch {
    return token;
  }
}

/** Help prose without inline code spans and link targets. */
function helpProse(line) {
  return line.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']');
}

export function findBrandLeaks(files) {
  const leaks = [];
  for (const file of files) {
    const filePath = normalize(file.path);
    if (EXEMPT.some((re) => re.test(filePath))) {
      continue;
    }
    const isLocale = LOCALE_PATH.test(filePath);
    const isHelp = HELP_PATH.test(filePath);
    const isSource = SOURCE_PATH.test(filePath);
    if (!isLocale && !isSource && !isHelp) {
      continue;
    }
    let inFence = false;
    const lines = file.text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const candidates = [];
      if (isLocale) {
        const m = JSON_VALUE.exec(line);
        if (m) {
          candidates.push(decodeJsonString(m[1]));
        }
      } else if (isHelp) {
        if (/^\s*(```|~~~)/.test(line)) {
          inFence = !inFence;
        } else if (!inFence) {
          candidates.push(helpProse(line));
        }
      } else {
        for (const m of line.matchAll(TITLE_LITERAL)) {
          candidates.push(m[2]);
        }
      }
      for (const candidate of candidates) {
        const hit = OLD_NAME.exec(candidate);
        if (hit) {
          leaks.push({ path: file.path, line: index + 1, match: hit[0] });
        }
      }
    });
  }
  return leaks;
}

function collect(root, dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(root, full, out);
      continue;
    }
    const rel = normalize(path.relative(root, full));
    if (LOCALE_PATH.test(rel) || SOURCE_PATH.test(rel) || HELP_PATH.test(rel)) {
      out.push({ path: rel, text: fs.readFileSync(full, 'utf8') });
    }
  }
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const files = [];
  collect(root, path.join(root, 'apps', 'desktop', 'src'), files);
  collect(root, path.join(root, 'apps', 'desktop', 'help-knowledge'), files);
  const leaks = findBrandLeaks(files);
  for (const leak of leaks) {
    console.error(`${leak.path}:${leak.line}: user-visible "${leak.match}"`);
  }
  if (leaks.length > 0) {
    console.error(`brand guard: ${leaks.length} leak(s)`);
    process.exit(1);
  }
  console.log(`brand guard: ok (${files.length} files scanned)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
