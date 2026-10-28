/**
 * Scrub check: fails when a tracked file, or a commit the fork added, carries
 * a key, a personal path, an email address or one of the owner's private words.
 *
 * Rules (rule id: what it matches; where it looks):
 *   anthropic-key, openai-key, github-token: real-shaped tokens; every line
 *   private-key-block: a PEM private-key header followed by a key body; whole file,
 *     and in --history the whole commit message and each file's added lines joined
 *   windows-user-path: a Windows user folder (drive letter, Users, a name; with
 *     backslashes, doubled backslashes or slashes), its URL-encoded form, the
 *     Git Bash form (a slash, the drive letter, then Users and a name) and the WSL
 *     /mnt/<letter>/Users/<name> form; lines the fork added
 *   local-path: any other drive-absolute path (a drive letter and a colon, then
 *     backslashes or slashes), a Git Bash drive path (a slash, one letter, a
 *     slash, a name), /Users/<name> and /home/<name> (with or without a
 *     trailing slash); lines the fork added
 *   email: an email address outside the allow list (the owner's noreply address,
 *     reserved example and test domains, @2x image names, URL userinfo, and the
 *     Co-Authored-By trailer address); lines the fork added and commit metadata
 *   private:<n>: line n of the local .scrub-patterns file; every line, never baselined
 *
 * Path and email rules see only the lines the fork added (diff against the base
 * in FORK-CHANGES.md, with rename detection), because upstream lines are
 * already public. Upstream licence files keep the emails their licences need.
 *
 * File names: every tracked path (skipped files included), and in --history every
 * path a commit added, renamed or copied, goes through the key rules and the
 * private words. A hit is reported as <path>:0.
 *
 * Skipped (skip reason in brackets):
 *   - binary files by extension [binary] and files marked filter=lfs [lfs]: no rule;
 *   - LICENSE and docs/legal/** [licence], and files marked -diff [no-diff]: no
 *     built-in rule, but the private words still run (on a -diff file only when it
 *     is text: no NUL byte in its first 8000 bytes, as git decides);
 *   - tracked files missing from the working tree (reported).
 * A NUL byte is not a reason to skip a normal file: real source files carry one
 * inside a string. A -text attribute alone is not either: vendored source and
 * teammate packages carry it to keep their bytes (a reviewed departure from the
 * design, which listed -text; skipping less is stricter).
 *
 * The skipped set is pinned in scrub-skipped.json: every tracked file skipped for
 * a reason other than a binary extension, with its reason. The tree mode fails on
 * a newly skipped file that is not listed and on a listed file that is no longer
 * skipped for that reason, so nothing leaves the check unseen.
 *
 * Accepted test fixtures are listed in scrub-baseline.json by file, rule and
 * the sha256 of the matched text (never the text). A finding not in the
 * baseline fails, and so does a baseline entry found fewer times than listed.
 *
 * --history also reads scrub-history-baseline.json: reviewed email findings in
 * commits, each named by commit subject, location, rule and the sha256 of the
 * address. Only the email rule can be listed there; identity, keys, paths and
 * private words are fixed by rewriting history. An entry that matches no finding
 * fails as stale.
 *
 * Output names path:line and rule only. It never prints the matched text, the
 * line, or a private pattern's source; the one exception is a file-name finding,
 * where the path it names is the matched text's container.
 *
 * Usage:
 *   node scripts/countersign/scrub-check.mjs             tracked files (git ls-files)
 *   node scripts/countersign/scrub-check.mjs --history   the fork's commits: author and
 *     committer email must be the owner's noreply address; messages and added lines
 *     go through every rule, added and renamed file names through the key rules and
 *     private words (git log --no-merges <base>..HEAD)
 *   --base <rev>   compare against <rev> instead of the Base line of FORK-CHANGES.md
 *
 * .scrub-patterns (git-ignored; see .scrub-patterns.example): one regular
 * expression per line, case-insensitive; # comments and blank lines ignored.
 * It must be UTF-8 text (a UTF-8 byte order mark is fine); UTF-16, NUL bytes or
 * invalid UTF-8 stop the check, so a mis-saved file never silently matches nothing.
 *
 * Exit codes:
 *   0  no findings
 *   1  findings, or a stale or invalid baseline entry
 *   2  input error: base unresolved, git failing, no tracked files, a bad pattern
 *      line, a .scrub-patterns that is not UTF-8 text or is a directory, a baseline
 *      file that cannot be read or has no "entries" list
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OWNER_EMAIL = '346368857+tejeshdevdas-py@users.noreply.github.com';
// Built from parts so this file does not match its own email rule.
const TRAILER_EMAIL = ['noreply', 'anthropic.com'].join('@');

const KEY_RULES = [
  { id: 'anthropic-key', re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: 'openai-key', re: /sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}/g },
  {
    id: 'github-token',
    re: /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/g,
  },
];
const PRIVATE_KEY_BLOCK =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]{0,300}?[A-Za-z0-9+/=]{40,}/g;
const WINDOWS_USER_PATH = [
  /(?<![A-Za-z0-9_-])[A-Za-z]:(?:\\{1,4}|\/)Users(?:\\{1,4}|\/)[^\\/\s"'`<>|*?:)\]]+/gi,
  // The URL-encoded user folder; split so this file does not match itself.
  new RegExp('%3A%5C' + 'Users' + '%5C[^%\\s"\'`<>&]*', 'gi'),
  // Git Bash form: a slash, the drive letter, a slash, Users, a name.
  /(?<![A-Za-z0-9_.-])\/[A-Za-z]\/Users\/[^/\s"'`<>|*?:)\]]+/g,
  // WSL form /mnt/<letter>/Users/<name>.
  /(?<![A-Za-z0-9_.~-])\/mnt\/[A-Za-z]\/Users\/[^/\s"'`<>|*?:)\]]+/gi,
];
// Each match runs to the end of its path token, so different paths hash differently.
const LOCAL_PATH = [
  // A drive letter and a colon, then backslashes.
  /(?<![A-Za-z0-9_-])[A-Za-z]:\\{1,4}[A-Za-z0-9_][^\s"'`<>|*?)\],;]*/g,
  // A drive letter and a colon, then slashes.
  /(?<![A-Za-z0-9_-])[A-Za-z]:\/{1,2}[A-Za-z0-9_][^\s"'`<>|*?)\],;]*/g,
  // Git Bash drive path: a slash, one letter, a slash, a name (not inside a URL or a relative path).
  /(?<![A-Za-z0-9_.~/:-])\/[A-Za-z]\/[A-Za-z0-9_][^\s"'`<>|*?)\],;]*/g,
  // /Users/<name> and /home/<name>, with or without a trailing slash.
  /(?<![A-Za-z0-9_.~-])\/(?:Users|home)\/[^/\s"'`<>|*?:)\]]+\/?/g,
];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Rule ids a baseline entry may name. Private words are never baselined. */
export const BASELINE_RULES = [
  'anthropic-key',
  'openai-key',
  'github-token',
  'private-key-block',
  'windows-user-path',
  'local-path',
  'email',
];

const BINARY_EXTENSION = /\.(?:png|webp|jpe?g|gif|ico|icns|mp3|ttf|pdf|dll|so|dylib|exe|node)$/i;

function normalize(p) {
  return p.replace(/\\/g, '/');
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function globalCopy(re) {
  return new RegExp(re.source, re.flags.replace(/[gy]/g, '') + 'g');
}

/**
 * Why a tracked file skips the built-in rules, or null when it does not:
 * 'licence' (LICENSE, docs/legal/**), 'binary' (a binary extension), 'lfs'
 * (filter=lfs) or 'no-diff' (-diff). See PRIVATE_WORDS_STILL_RUN.
 * @param {string} filePath repo-relative path
 * @param {{filter?: string, diff?: string}} [attrs] git attributes of the file
 */
export function skipReason(filePath, attrs = {}) {
  const p = normalize(filePath);
  if (p === 'LICENSE' || p.startsWith('docs/legal/')) {
    return 'licence';
  }
  if (BINARY_EXTENSION.test(p)) {
    return 'binary';
  }
  if (attrs.filter === 'lfs') {
    return 'lfs';
  }
  if (attrs.diff === 'unset') {
    return 'no-diff';
  }
  return null;
}

/** Skip reasons under which the private words still run (on text). */
export const PRIVATE_WORDS_STILL_RUN = new Set(['licence', 'no-diff']);

/** Skip reasons pinned in scrub-skipped.json: every reason but a binary extension. */
export const PINNED_SKIP_REASONS = ['licence', 'lfs', 'no-diff'];

/** Git's own test for binary content: a NUL byte in the first 8000 bytes. */
function looksBinary(text) {
  return text.slice(0, 8000).includes('\u0000');
}

/** True when an email-shaped match is allowed (see the header). */
export function isAllowedEmail(address, line, index) {
  const lower = address.toLowerCase();
  if (lower === OWNER_EMAIL) {
    return true;
  }
  const domain = lower.slice(lower.lastIndexOf('@') + 1);
  if (/^(?:[a-z0-9-]+\.)*example\.(?:com|org|net)$/.test(domain)) {
    return true;
  }
  if (/\.(?:example|test|invalid|localhost)$/.test(domain)) {
    return true;
  }
  if (/^\d+x\.(?:png|jpe?g|webp)$/.test(domain)) {
    return true;
  }
  // URL userinfo: //user@host or //user:secret@host.
  if (/\/\/[^\s/@"'`]*$/.test(line.slice(0, index))) {
    return true;
  }
  return lower === TRAILER_EMAIL && /^\s*Co-Authored-By:/i.test(line);
}

function spans(line, regexes) {
  const out = [];
  for (const re of regexes) {
    for (const m of line.matchAll(re)) {
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }
  return out;
}

/** Findings on one line: [{rule, text}]. `added` turns on the path and email rules. */
function lineFindings(line, added, privatePatterns) {
  const out = [];
  for (const rule of KEY_RULES) {
    for (const m of line.matchAll(rule.re)) {
      out.push({ rule: rule.id, text: m[0] });
    }
  }
  out.push(...privateFindings(line, privatePatterns));
  if (!added) {
    return out;
  }
  const userPaths = spans(line, WINDOWS_USER_PATH);
  for (const s of userPaths) {
    out.push({ rule: 'windows-user-path', text: s.text });
  }
  for (const s of spans(line, LOCAL_PATH)) {
    const overlaps = userPaths.some((u) => s.start < u.end && u.start < s.end);
    if (!overlaps) {
      out.push({ rule: 'local-path', text: s.text });
    }
  }
  for (const m of line.matchAll(EMAIL)) {
    if (!isAllowedEmail(m[0], line, m.index)) {
      out.push({ rule: 'email', text: m[0] });
    }
  }
  return out;
}

function toPrivatePatterns(extraPatterns) {
  return extraPatterns.map((item, index) => {
    if (item instanceof RegExp) {
      return { line: index + 1, re: globalCopy(item) };
    }
    return { line: item.line, re: globalCopy(item.re) };
  });
}

function lineOfIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

/** Private-word findings on one line: [{rule, text}]. */
function privateFindings(line, privatePatterns) {
  const out = [];
  for (const pattern of privatePatterns) {
    for (const m of line.matchAll(pattern.re)) {
      out.push({ rule: `private:${pattern.line}`, text: m[0] });
    }
  }
  return out;
}

/**
 * How a file is scanned: 'all' rules, 'private' words only, or 'none'.
 * @param {string} filePath repo-relative path
 * @param {{filter?: string, diff?: string}} [attrs] git attributes of the file
 * @param {string} [text] the file's text, when read (a -diff file is scanned only as text)
 */
export function scanMode(filePath, attrs, text) {
  const reason = skipReason(filePath, attrs);
  if (reason === null) {
    return 'all';
  }
  if (!PRIVATE_WORDS_STILL_RUN.has(reason)) {
    return 'none';
  }
  return reason === 'no-diff' && text !== undefined && looksBinary(text) ? 'none' : 'private';
}

/**
 * Scans in-memory files.
 * @param {{path: string, text: string, attrs?: {filter?: string, diff?: string}}[]} files
 * @param {(RegExp|{line: number, re: RegExp})[]} [extraPatterns] private words
 * @param {{addedLines?: Map<string, Set<number>>}} [options] lines the fork added,
 *   per repo-relative path; when absent every line counts as added
 * @returns {{path: string, line: number, rule: string, matchHash: string}[]}
 */
export function scrub(files, extraPatterns = [], options = {}) {
  const { addedLines } = options;
  const privatePatterns = toPrivatePatterns(extraPatterns);
  const findings = [];
  for (const file of files) {
    const filePath = normalize(file.path);
    const mode = scanMode(filePath, file.attrs, file.text);
    if (mode === 'none') {
      continue;
    }
    const added = addedLines ? (addedLines.get(filePath) ?? new Set()) : null;
    if (mode === 'all') {
      for (const m of file.text.matchAll(PRIVATE_KEY_BLOCK)) {
        findings.push({
          path: filePath,
          line: lineOfIndex(file.text, m.index),
          rule: 'private-key-block',
          matchHash: sha256(m[0]),
        });
      }
    }
    const lines = file.text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const lineNo = index + 1;
      const isAdded = added === null || added.has(lineNo);
      const hits =
        mode === 'all'
          ? lineFindings(line, isAdded, privatePatterns)
          : privateFindings(line, privatePatterns);
      for (const hit of hits) {
        findings.push({
          path: filePath,
          line: lineNo,
          rule: hit.rule,
          matchHash: sha256(hit.text),
        });
      }
    });
  }
  return findings;
}

/**
 * Findings in file names: each path goes through the key rules and the private
 * words (not the path or email rules, which would flag every folder name),
 * reported as line 0. Every path is checked, skipped files included.
 * @param {string[]} paths repo-relative paths
 * @returns {{path: string, line: 0, rule: string, matchHash: string}[]}
 */
export function scrubPaths(paths, extraPatterns = []) {
  const privatePatterns = toPrivatePatterns(extraPatterns);
  const findings = [];
  for (const raw of paths) {
    const filePath = normalize(raw);
    for (const hit of lineFindings(filePath, false, privatePatterns)) {
      findings.push({ path: filePath, line: 0, rule: hit.rule, matchHash: sha256(hit.text) });
    }
  }
  return findings;
}

/**
 * Parses .scrub-patterns text. Each non-comment line is compiled as
 * new RegExp(line, 'i'); g and y never apply.
 * @returns {{patterns: {line: number, re: RegExp}[], errors: number[]}} errors are line numbers
 */
export function parsePatterns(text) {
  const patterns = [];
  const errors = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) {
      return;
    }
    try {
      patterns.push({ line: index + 1, re: new RegExp(line, 'i') });
    } catch {
      errors.push(index + 1);
    }
  });
  return { patterns, errors };
}

function baselineKey(file, rule, hash) {
  return `${normalize(file)}\u0000${rule}\u0000${hash}`;
}

/** Problems with the baseline entries themselves (empty when valid). Never names matched text. */
export function validateBaseline(entries) {
  const problems = [];
  const seen = new Set();
  entries.forEach((e, index) => {
    const where = `entry ${index + 1} (${e.file ?? '?'} ${e.rule ?? '?'})`;
    if (typeof e.file !== 'string' || e.file.length === 0) {
      problems.push(`${where}: no file`);
    }
    if (!BASELINE_RULES.includes(e.rule)) {
      problems.push(`${where}: rule cannot be baselined`);
    }
    if (typeof e.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(e.sha256)) {
      problems.push(`${where}: sha256 must be 64 lower-case hex characters`);
    }
    if (!Number.isInteger(e.count) || e.count < 1) {
      problems.push(`${where}: count must be a positive integer`);
    }
    if (typeof e.reason !== 'string' || e.reason.trim().length === 0) {
      problems.push(`${where}: no reason`);
    }
    const key = baselineKey(e.file ?? '', e.rule ?? '', e.sha256 ?? '');
    if (seen.has(key)) {
      problems.push(`${where}: listed twice`);
    }
    seen.add(key);
  });
  return problems;
}

/**
 * Findings beyond their baseline count (fresh) and entries found fewer times (stale).
 * Private-word findings are always fresh.
 */
export function compareWithBaseline(findings, entries) {
  const groups = new Map();
  const fresh = [];
  for (const f of findings) {
    if (f.rule.startsWith('private:')) {
      fresh.push(f);
      continue;
    }
    const key = baselineKey(f.path, f.rule, f.matchHash);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(f);
  }
  const allowed = new Map(entries.map((e) => [baselineKey(e.file, e.rule, e.sha256), e.count]));
  for (const [key, group] of groups) {
    fresh.push(...group.slice(allowed.get(key) ?? 0));
  }
  const stale = [];
  for (const e of entries) {
    const found = groups.get(baselineKey(e.file, e.rule, e.sha256))?.length ?? 0;
    if (found < e.count) {
      stale.push({ ...e, found });
    }
  }
  return { fresh, stale };
}

/** Problems with the skipped-list entries themselves (empty when valid). */
export function validateSkipped(entries) {
  const problems = [];
  const seen = new Set();
  entries.forEach((e, index) => {
    const where = `entry ${index + 1} (${e.file ?? '?'})`;
    if (typeof e.file !== 'string' || e.file.length === 0) {
      problems.push(`${where}: no file`);
    }
    if (!PINNED_SKIP_REASONS.includes(e.reason)) {
      problems.push(`${where}: reason must be one of ${PINNED_SKIP_REASONS.join(', ')}`);
    }
    const key = normalize(e.file ?? '');
    if (seen.has(key)) {
      problems.push(`${where}: listed twice`);
    }
    seen.add(key);
  });
  return problems;
}

/**
 * Files skipped for a pinned reason but not listed (fresh), and listed files that
 * are not skipped for the listed reason (stale).
 * @param {Map<string, string>} skipped repo-relative path -> pinned skip reason
 * @param {{file: string, reason: string}[]} entries
 */
export function compareSkipped(skipped, entries) {
  const listed = new Map(entries.map((e) => [normalize(e.file), e.reason]));
  const fresh = [];
  for (const [file, reason] of skipped) {
    if (listed.get(file) !== reason) {
      fresh.push({ file, reason });
    }
  }
  const stale = [];
  for (const [file, reason] of listed) {
    if (skipped.get(file) !== reason) {
      stale.push({ file, reason });
    }
  }
  return { fresh, stale };
}

function unquoteDiffPath(raw) {
  if (!raw.startsWith('"')) {
    return raw;
  }
  // Git C-quotes names with special characters; octal escapes are UTF-8 bytes.
  const bytes = [];
  const body = raw.slice(1, -1);
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch !== '\\') {
      bytes.push(...Buffer.from(ch, 'utf8'));
      continue;
    }
    const next = body[i + 1];
    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(body.slice(i + 1, i + 4), 8));
      i += 3;
      continue;
    }
    const escapes = { n: 10, t: 9, r: 13, '"': 34, '\\': 92, a: 7, b: 8, f: 12, v: 11 };
    bytes.push(escapes[next] ?? next.charCodeAt(0));
    i += 1;
  }
  return Buffer.from(bytes).toString('utf8');
}

/**
 * Lines added by a unified diff (git diff -U0 with a/ and b/ prefixes).
 * Each hunk header gives how many old and new lines follow; inside a hunk every
 * line is content, so an added line whose text starts with "++ " (shown as
 * "+++ ...") is never read as a file header.
 * @returns {Map<string, {line: number, text: string}[]>} per new path
 */
export function parseAddedLines(diffText) {
  const out = new Map();
  let current = null;
  let nextLine = 0;
  let oldLeft = 0;
  let newLeft = 0;
  for (const raw of diffText.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (oldLeft > 0 || newLeft > 0) {
      if (line.startsWith('+')) {
        if (current !== null) {
          out.get(current).push({ line: nextLine, text: line.slice(1) });
        }
        nextLine += 1;
        newLeft -= 1;
      } else if (line.startsWith('-')) {
        oldLeft -= 1;
      } else if (line.startsWith(' ')) {
        nextLine += 1;
        oldLeft -= 1;
        newLeft -= 1;
      }
      // "\ No newline at end of file" belongs to the hunk and counts on neither side.
      continue;
    }
    if (line.startsWith('diff --git ')) {
      current = null;
      continue;
    }
    if (line.startsWith('+++ ')) {
      // Git ends the header with a TAB when the name contains a space.
      const target = line.slice(4).replace(/\t$/, '');
      current = target === '/dev/null' ? null : unquoteDiffPath(target).replace(/^b\//, '');
      if (current !== null && !out.has(current)) {
        out.set(current, []);
      }
      continue;
    }
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1]);
      nextLine = Number(hunk[2]);
      newLeft = hunk[3] === undefined ? 1 : Number(hunk[3]);
    }
  }
  return out;
}

function git(root, args, input) {
  const result = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: root,
    input,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    return { ok: false, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }
  return { ok: true, stdout: result.stdout, stderr: result.stderr };
}

// --text: a source file with a NUL byte in a string is still diffed line by line;
// real binaries are dropped by skipReason before any rule runs.
const DIFF_ARGS = [
  '-U0',
  '-M',
  '-l0',
  '--text',
  '--no-color',
  '--no-ext-diff',
  '--no-textconv',
  '--src-prefix=a/',
  '--dst-prefix=b/',
];

// The names a commit added, renamed or copied (new names only), NUL-separated.
const NAME_ARGS = ['--name-only', '-z', '-M', '-l0', '--diff-filter=ACR', '--no-color'];

/** The base commit from the `Base:` line of FORK-CHANGES.md, or null. */
export function readForkBase(forkChangesText) {
  const line = forkChangesText.split(/\r?\n/).find((l) => l.startsWith('Base:'));
  const sha = line ? /\b([0-9a-f]{40})\b/.exec(line) : null;
  return sha ? sha[1] : null;
}

function readAttributes(root, files) {
  const result = git(root, ['check-attr', '--stdin', '-z', 'filter', 'diff'], files.join('\0'));
  if (!result.ok) {
    return null;
  }
  const attrs = new Map();
  const parts = result.stdout.split('\0');
  for (let i = 0; i + 2 < parts.length; i += 3) {
    const entry = attrs.get(parts[i]) ?? {};
    entry[parts[i + 1]] = parts[i + 2];
    attrs.set(parts[i], entry);
  }
  return attrs;
}

/**
 * The text of a .scrub-patterns file, or null when it is not UTF-8: a UTF-16 or
 * UTF-32 byte order mark, a NUL byte, or bytes that are not valid UTF-8 (a file
 * saved in a legacy code page). A UTF-8 byte order mark is dropped.
 */
export function decodePatternsFile(bytes) {
  const utf16Bom =
    bytes.length >= 2 &&
    ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff));
  if (utf16Bom || bytes.includes(0)) {
    return null;
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function loadPatterns(root, error) {
  const file = path.join(root, '.scrub-patterns');
  const failed = { patterns: [], present: true, failed: true };
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { patterns: [], present: false };
    }
    error(`scrub: cannot read .scrub-patterns (${err.code})`);
    return failed;
  }
  if (stat.isDirectory()) {
    error('scrub: .scrub-patterns is a directory; it must be a UTF-8 text file');
    return failed;
  }
  const text = decodePatternsFile(fs.readFileSync(file));
  if (text === null) {
    error(
      'scrub: .scrub-patterns is not UTF-8 text (a UTF-16 byte order mark, NUL bytes or invalid UTF-8); save it as UTF-8',
    );
    return failed;
  }
  const { patterns, errors } = parsePatterns(text);
  for (const line of errors) {
    error(`.scrub-patterns:${line}: not a valid regular expression`);
  }
  return { patterns, present: true, failed: errors.length > 0 };
}

function resolveBase(root, explicitBase, error) {
  let base = explicitBase;
  if (!base) {
    const forkChanges = path.join(root, 'FORK-CHANGES.md');
    base = fs.existsSync(forkChanges) ? readForkBase(fs.readFileSync(forkChanges, 'utf8')) : null;
  }
  if (!base) {
    error('scrub: no base commit (pass --base or keep the Base line in FORK-CHANGES.md)');
    return null;
  }
  const verified = git(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  if (!verified.ok) {
    error(`scrub: base ${base} does not resolve to a commit in this clone`);
    return null;
  }
  return verified.stdout.trim();
}

const SKIPPED_REL = 'scripts/countersign/scrub-skipped.json';

/**
 * The entries of a list file (repo-relative `rel`: a baseline or the skipped list),
 * [] when the file does not exist, or null after reporting why it cannot be used.
 */
function loadListFile(root, rel, error) {
  if (!fs.existsSync(path.join(root, rel))) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  } catch {
    error(`scrub: cannot read ${rel}`);
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
    error(`scrub: ${rel} has no "entries" list`);
    return null;
  }
  return parsed.entries;
}

function runTree({ root, base, patterns, baseline, skippedEntries, log, error }) {
  const listed = git(root, ['ls-files', '-z']);
  const files = listed.ok ? listed.stdout.split('\0').filter(Boolean) : [];
  if (files.length === 0) {
    error('scrub: git ls-files failed or listed no files');
    return 2;
  }
  const attrs = readAttributes(root, files);
  const diff = git(root, ['diff', ...DIFF_ARGS, base, '--', '.']);
  if (attrs === null || !diff.ok) {
    error('scrub: git check-attr or git diff failed');
    return 2;
  }
  const addedLines = new Map();
  for (const [file, lines] of parseAddedLines(diff.stdout)) {
    addedLines.set(file, new Set(lines.map((l) => l.line)));
  }
  const toScan = [];
  const missing = [];
  const pinned = new Map();
  let skipped = 0;
  let privateOnly = 0;
  for (const file of files) {
    const fileAttrs = attrs.get(file);
    const reason = skipReason(file, fileAttrs);
    if (PINNED_SKIP_REASONS.includes(reason)) {
      pinned.set(normalize(file), reason);
    }
    // A skipped file is read only when the private words still run on it.
    if (reason !== null && !(PRIVATE_WORDS_STILL_RUN.has(reason) && patterns.length > 0)) {
      skipped += 1;
      continue;
    }
    let text;
    try {
      text = fs.readFileSync(path.join(root, file), 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'EISDIR') {
        error(`scrub: cannot read ${file} (${err.code})`);
        return 2;
      }
      missing.push(file);
      skipped += 1;
      continue;
    }
    if (scanMode(file, fileAttrs, text) === 'none') {
      skipped += 1;
      continue;
    }
    if (reason !== null) {
      privateOnly += 1;
    }
    toScan.push({ path: file, text, attrs: fileAttrs });
  }
  const findings = [...scrubPaths(files, patterns), ...scrub(toScan, patterns, { addedLines })];
  const { fresh, stale } = compareWithBaseline(findings, baseline);
  const skippedCheck = compareSkipped(pinned, skippedEntries);
  for (const f of fresh) {
    log(`${f.path}:${f.line} ${f.rule}`);
  }
  for (const e of stale) {
    log(
      `${e.file} ${e.rule}: baseline entry found ${e.found} of ${e.count} time(s); shrink the baseline`,
    );
  }
  for (const s of skippedCheck.fresh) {
    log(`${s.file}: skipped (${s.reason}) but not listed in ${SKIPPED_REL}`);
  }
  for (const s of skippedCheck.stale) {
    log(
      `${s.file}: listed in ${SKIPPED_REL} (${s.reason}) but not skipped for that reason; remove it`,
    );
  }
  for (const file of missing) {
    log(`${file}: skipped, not in the working tree`);
  }
  const problems =
    fresh.length + stale.length + skippedCheck.fresh.length + skippedCheck.stale.length;
  const privateNote = privateOnly > 0 ? ` (${privateOnly} for private words only)` : '';
  log(
    `${problems} finding${problems === 1 ? '' : 's'}; ${toScan.length} files scanned${privateNote}, ${skipped} skipped`,
  );
  return problems > 0 ? 1 : 0;
}

/** Splits `git log` output written with HISTORY_FORMAT into commits. */
function parseCommits(text) {
  return text
    .split('\u001e')
    .map((chunk) => chunk.replace(/^\n/, ''))
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const [sha, an, ae, cn, ce, body] = chunk.split('\u0000');
      return { sha, an, ae, cn, ce, body: body ?? '' };
    });
}

const HISTORY_FORMAT = '--format=%H%x00%an%x00%ae%x00%cn%x00%ce%x00%B%x1e';

/**
 * Scans commits: identity, message lines and added lines.
 * @param {{sha: string, an: string, ae: string, cn: string, ce: string, body: string, added: Map<string, {line: number, text: string}[]>}[]} commits
 * @returns {{sha: string, where: string, rule: string, path?: string, matchHash?: string}[]}
 */
export function scrubHistory(commits, extraPatterns = []) {
  const privatePatterns = toPrivatePatterns(extraPatterns);
  const findings = [];
  for (const c of commits) {
    if ((c.ae ?? '').toLowerCase() !== OWNER_EMAIL) {
      findings.push({ sha: c.sha, where: 'author', rule: 'identity' });
    }
    if ((c.ce ?? '').toLowerCase() !== OWNER_EMAIL) {
      findings.push({ sha: c.sha, where: 'committer', rule: 'identity' });
    }
    for (const [where, name] of [
      ['author', c.an],
      ['committer', c.cn],
    ]) {
      for (const hit of lineFindings(name ?? '', false, privatePatterns)) {
        findings.push({ sha: c.sha, where: `${where} name`, rule: hit.rule });
      }
    }
    for (const m of c.body.matchAll(PRIVATE_KEY_BLOCK)) {
      findings.push({
        sha: c.sha,
        where: `message:${lineOfIndex(c.body, m.index)}`,
        rule: 'private-key-block',
        matchHash: sha256(m[0]),
      });
    }
    c.body.split(/\r?\n/).forEach((line, index) => {
      for (const hit of lineFindings(line, true, privatePatterns)) {
        findings.push({
          sha: c.sha,
          where: `message:${index + 1}`,
          rule: hit.rule,
          matchHash: sha256(hit.text),
        });
      }
    });
    // File names the commit added, renamed or copied: key rules and private words.
    for (const f of scrubPaths(c.paths ?? [], extraPatterns)) {
      findings.push({
        sha: c.sha,
        where: `${f.path}:0`,
        rule: f.rule,
        path: f.path,
        matchHash: f.matchHash,
      });
    }
    for (const [file, lines] of c.added) {
      // History reads no attributes: a binary extension skips every rule, and a
      // licence file gets the private words only (as in the tree mode).
      const mode = scanMode(file);
      if (mode === 'none') {
        continue;
      }
      const joined = lines.map((l) => l.text).join('\n');
      for (const m of mode === 'all' ? joined.matchAll(PRIVATE_KEY_BLOCK) : []) {
        const line = lines[lineOfIndex(joined, m.index) - 1].line;
        findings.push({
          sha: c.sha,
          where: `${file}:${line}`,
          rule: 'private-key-block',
          path: file,
          matchHash: sha256(m[0]),
        });
      }
      for (const l of lines) {
        const hits =
          mode === 'all'
            ? lineFindings(l.text, true, privatePatterns)
            : privateFindings(l.text, privatePatterns);
        for (const hit of hits) {
          findings.push({
            sha: c.sha,
            where: `${file}:${l.line}`,
            rule: hit.rule,
            path: file,
            matchHash: sha256(hit.text),
          });
        }
      }
    }
  }
  return findings;
}

/** Rule ids a history baseline entry may name; anything else is fixed by rewriting history. */
export const HISTORY_BASELINE_RULES = ['email'];

function historyKey(subject, where, rule, hash) {
  return `${subject}\u0000${where}\u0000${rule}\u0000${hash}`;
}

function subjectOf(body) {
  return (body ?? '').split(/\r?\n/)[0];
}

/** Problems with the history baseline entries (empty when valid). Never names matched text. */
export function validateHistoryBaseline(entries) {
  const problems = [];
  const seen = new Set();
  entries.forEach((e, index) => {
    const label = `entry ${index + 1} (${e.where ?? '?'} ${e.rule ?? '?'})`;
    if (typeof e.commit !== 'string' || e.commit.trim().length === 0) {
      problems.push(`${label}: no commit subject`);
    }
    if (typeof e.where !== 'string' || !/^.+:\d+$/.test(e.where)) {
      problems.push(`${label}: where must be <path>:<line> or message:<line>`);
    }
    if (!HISTORY_BASELINE_RULES.includes(e.rule)) {
      problems.push(`${label}: only the email rule can be accepted in history`);
    }
    if (typeof e.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(e.sha256)) {
      problems.push(`${label}: sha256 must be 64 lower-case hex characters`);
    }
    if (typeof e.reason !== 'string' || e.reason.trim().length === 0) {
      problems.push(`${label}: no reason`);
    }
    const key = historyKey(e.commit ?? '', e.where ?? '', e.rule ?? '', e.sha256 ?? '');
    if (seen.has(key)) {
      problems.push(`${label}: listed twice`);
    }
    seen.add(key);
  });
  return problems;
}

/**
 * Splits history findings into fresh ones and ones a history baseline entry accepts.
 * An entry accepts the email findings at its location and hash in the commit whose
 * subject (first message line) it names, so it survives re-authoring but not a change
 * to that line. An entry that accepts nothing is stale.
 * @returns {{fresh: object[], accepted: number, stale: {index: number, entry: object}[]}}
 *   stale indexes are 1-based
 */
export function compareWithHistoryBaseline(findings, entries, commits) {
  const subjects = new Map(commits.map((c) => [c.sha, subjectOf(c.body)]));
  const indexByKey = new Map(
    entries.map((e, index) => [historyKey(e.commit, e.where, e.rule, e.sha256), index]),
  );
  const used = new Set();
  const fresh = [];
  let accepted = 0;
  for (const f of findings) {
    const acceptable = f.matchHash && HISTORY_BASELINE_RULES.includes(f.rule);
    const key = historyKey(subjects.get(f.sha) ?? '', f.where, f.rule, f.matchHash ?? '');
    const index = acceptable ? indexByKey.get(key) : undefined;
    if (index === undefined) {
      fresh.push(f);
      continue;
    }
    used.add(index);
    accepted += 1;
  }
  const stale = [];
  entries.forEach((entry, index) => {
    if (!used.has(index)) {
      stale.push({ index: index + 1, entry });
    }
  });
  return { fresh, accepted, stale };
}

function runHistory({ root, base, patterns, baseline, historyBaseline, log, error }) {
  const listed = git(root, ['log', '--no-merges', HISTORY_FORMAT, `${base}..HEAD`]);
  if (!listed.ok) {
    error('scrub: git log failed');
    return 2;
  }
  const commits = parseCommits(listed.stdout);
  for (const c of commits) {
    const diff = git(root, ['diff', ...DIFF_ARGS, `${c.sha}^`, c.sha]);
    const names = git(root, ['diff', ...NAME_ARGS, `${c.sha}^`, c.sha]);
    if (!diff.ok || !names.ok) {
      error(`scrub: git diff failed for ${c.sha.slice(0, 9)}`);
      return 2;
    }
    c.added = parseAddedLines(diff.stdout);
    c.paths = names.stdout.split('\0').filter(Boolean);
  }
  // A fixture accepted in the tree baseline is accepted in the commit that added it.
  const accepted = new Set(baseline.map((e) => baselineKey(e.file, e.rule, e.sha256)));
  const findings = scrubHistory(commits, patterns).filter(
    (f) => !(f.path && f.matchHash && accepted.has(baselineKey(f.path, f.rule, f.matchHash))),
  );
  const compared = compareWithHistoryBaseline(findings, historyBaseline, commits);
  for (const f of compared.fresh) {
    log(`${f.sha.slice(0, 9)} ${f.where} ${f.rule}`);
  }
  for (const s of compared.stale) {
    log(
      `history baseline entry ${s.index} (${s.entry.where} ${s.entry.rule}): matches no finding; remove it`,
    );
  }
  if (compared.accepted > 0) {
    log(
      `${compared.accepted} finding${compared.accepted === 1 ? '' : 's'} accepted by the history baseline`,
    );
  }
  const problems = compared.fresh.length + compared.stale.length;
  log(`${problems} finding${problems === 1 ? '' : 's'}; ${commits.length} commits scanned`);
  return problems > 0 ? 1 : 0;
}

/** Runs the check from `cwd`; returns the process exit code. */
export function main({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  log = (line) => console.log(line),
  error = (line) => console.error(line),
} = {}) {
  let history = false;
  let explicitBase = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--') {
      continue;
    }
    if (argv[i] === '--history') {
      history = true;
    } else if (argv[i] === '--base') {
      i += 1;
      explicitBase = argv[i] ?? '';
    } else {
      error(`scrub: unknown argument ${argv[i]}`);
      return 2;
    }
  }
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  if (!top.ok) {
    error('scrub: not inside a git work tree');
    return 2;
  }
  const root = top.stdout.trim();
  const base = resolveBase(root, explicitBase, error);
  if (base === null) {
    return 2;
  }
  const loaded = loadPatterns(root, error);
  if (loaded.failed) {
    return 2;
  }
  const baseline = loadListFile(root, 'scripts/countersign/scrub-baseline.json', error);
  if (baseline === null) {
    return 2;
  }
  const problems = validateBaseline(baseline);
  for (const problem of problems) {
    error(`scrub baseline: ${problem}`);
  }
  if (problems.length > 0) {
    return 1;
  }
  let historyBaseline = [];
  let skippedEntries = [];
  if (history) {
    historyBaseline = loadListFile(root, 'scripts/countersign/scrub-history-baseline.json', error);
    if (historyBaseline === null) {
      return 2;
    }
    const historyProblems = validateHistoryBaseline(historyBaseline);
    for (const problem of historyProblems) {
      error(`scrub history baseline: ${problem}`);
    }
    if (historyProblems.length > 0) {
      return 1;
    }
  } else {
    skippedEntries = loadListFile(root, SKIPPED_REL, error);
    if (skippedEntries === null) {
      return 2;
    }
    const skippedProblems = validateSkipped(skippedEntries);
    for (const problem of skippedProblems) {
      error(`scrub skipped list: ${problem}`);
    }
    if (skippedProblems.length > 0) {
      return 1;
    }
  }
  log(
    loaded.present
      ? `scrub: built-in rules and ${loaded.patterns.length} private pattern(s) from .scrub-patterns`
      : 'scrub: built-in rules only (no .scrub-patterns file)',
  );
  const context = {
    root,
    base,
    patterns: loaded.patterns,
    baseline,
    historyBaseline,
    skippedEntries,
    log,
    error,
  };
  return history ? runHistory(context) : runTree(context);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
