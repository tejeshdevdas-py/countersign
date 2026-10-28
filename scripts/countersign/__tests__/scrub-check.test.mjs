import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  OWNER_EMAIL,
  compareWithBaseline,
  compareWithHistoryBaseline,
  isAllowedEmail,
  parseAddedLines,
  parsePatterns,
  readForkBase,
  scrub,
  scrubHistory,
  skipReason,
  validateBaseline,
  validateHistoryBaseline,
} from '../scrub-check.mjs';

const SCRIPT = fileURLToPath(new URL('../scrub-check.mjs', import.meta.url));

// Every positive fixture is built at run time from parts, so this file never
// matches the rules it tests and no literal looks like a real secret.
const ANTHROPIC_KEY = ['sk', 'ant', 'api03', 'A'.repeat(40)].join('-');
const OPENAI_KEY = ['sk', 'proj', 'B'.repeat(40)].join('-');
const GITHUB_TOKEN = ['ghp', 'aB3'.repeat(12)].join('_');
const PEM_HEADER = ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ');
const PEM_FOOTER = ['-----END', 'PRIVATE', 'KEY-----'].join(' ');
const PEM_BLOCK = [PEM_HEADER, 'M'.repeat(64), 'N'.repeat(64), PEM_FOOTER].join('\n');
const USER_PATH = ['C:', 'Users', 'someone', ''].join('\\');
const TOOLS_PATH = ['C:', 'Tools', 'bin'].join('\\');
const OUTSIDE_EMAIL = ['dev', 'acme-widgets.com'].join('@');
const TRAILER_EMAIL = ['noreply', 'anthropic.com'].join('@');
const PRIVATE_WORD = 'zorblaxcorp';

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function rules(findings) {
  return findings.map((f) => f.rule).sort();
}

test('built-in rules flag a user path, the three token shapes and a private key block', () => {
  const text = [
    `const home = '${USER_PATH}';`,
    `const a = '${ANTHROPIC_KEY}';`,
    `const o = '${OPENAI_KEY}';`,
    `const g = '${GITHUB_TOKEN}';`,
    PEM_BLOCK,
  ].join('\n');
  const findings = scrub([{ path: 'src/fixture.ts', text }], []);
  assert.deepEqual(rules(findings), [
    'anthropic-key',
    'github-token',
    'openai-key',
    'private-key-block',
    'windows-user-path',
  ]);
  const pem = findings.find((f) => f.rule === 'private-key-block');
  assert.equal(pem.line, 5, 'a key block is reported on its BEGIN line');
});

test('a private key header with no key body is not flagged', () => {
  const text = `docs mention ${PEM_HEADER} as a format name\n`;
  assert.deepEqual(scrub([{ path: 'docs/keys.md', text }], []), []);
});

test('an extra pattern flags its word as private:<line in the pattern file>', () => {
  const { patterns, errors } = parsePatterns(`# my words\n\n\\b${PRIVATE_WORD}\\b\n`);
  assert.deepEqual(errors, []);
  const findings = scrub(
    [{ path: 'a.md', text: `x\nWorks at ${PRIVATE_WORD.toUpperCase()}\n` }],
    patterns,
  );
  assert.deepEqual(
    findings.map((f) => [f.path, f.line, f.rule]),
    [['a.md', 2, 'private:3']],
  );
});

test('a plain RegExp extra pattern is numbered by its position', () => {
  const findings = scrub(
    [{ path: 'a.md', text: PRIVATE_WORD }],
    [/nothing/, new RegExp(PRIVATE_WORD)],
  );
  assert.deepEqual(rules(findings), ['private:2']);
});

test('LICENSE and docs/legal are skipped', () => {
  const text = `${ANTHROPIC_KEY} ${USER_PATH} ${OUTSIDE_EMAIL}`;
  const files = ['LICENSE', 'docs/legal/notices/desktop-win.txt'].map((p) => ({ path: p, text }));
  assert.deepEqual(scrub(files, [new RegExp('sk-')]), []);
  assert.equal(scrub([{ path: 'docs/LICENSE.md', text }], []).length > 0, true);
});

test('the skipped list: binaries by extension, lfs and -diff; not -text alone, not a NUL byte', () => {
  const cases = [
    ['LICENSE', {}],
    ['docs/legal/notices/x.txt', {}],
    ['assets/logo.PNG', {}],
    ['native/vec0.dll', {}],
    ['design/board.pen', { filter: 'lfs' }],
    ['data/blob.bin', { diff: 'unset' }],
    ['packages/opencli-vendor/src/node-network.ts', { diff: 'unspecified', filter: 'unspecified' }],
    ['apps/desktop/resources/bot-packages/a/SKILL.md', {}],
    ['src/loader.ts', {}],
  ];
  const skipped = cases.filter(([p, attrs]) => skipReason(p, attrs) !== null).map(([p]) => p);
  assert.deepEqual(skipped, [
    'LICENSE',
    'docs/legal/notices/x.txt',
    'assets/logo.PNG',
    'native/vec0.dll',
    'design/board.pen',
    'data/blob.bin',
  ]);
  const withNul = `const sep = '\u0000';\nconst k = '${ANTHROPIC_KEY}';\n`;
  assert.deepEqual(rules(scrub([{ path: 'src/loader.ts', text: withNul }], [])), ['anthropic-key']);
});

test('path and email rules see only added lines; key and private rules see every line', () => {
  const text = [
    `upstream ${USER_PATH} ${OUTSIDE_EMAIL} ${TOOLS_PATH}`,
    `fork ${USER_PATH} ${OUTSIDE_EMAIL} ${TOOLS_PATH}`,
    `upstream key ${ANTHROPIC_KEY} ${PRIVATE_WORD}`,
  ].join('\n');
  const addedLines = new Map([['src/x.ts', new Set([2])]]);
  const findings = scrub([{ path: 'src/x.ts', text }], [new RegExp(PRIVATE_WORD)], { addedLines });
  assert.deepEqual(findings.map((f) => `${f.line} ${f.rule}`).sort(), [
    '2 email',
    '2 local-path',
    '2 windows-user-path',
    '3 anthropic-key',
    '3 private:1',
  ]);
  const untouched = scrub([{ path: 'src/y.ts', text }], [], { addedLines });
  assert.deepEqual(
    rules(untouched),
    ['anthropic-key'],
    'a file with no added lines keeps the key rules',
  );
});

test('a user path is reported once, as windows-user-path, in each spelling', () => {
  const spellings = [
    USER_PATH,
    ['C:', 'Users', 'someone', 'x'].join('/'),
    ['C:', 'Users', 'someone', 'x'].join('\\\\'),
    ['c:', 'users', 'someone'].join('\\'),
    ['%3A%5C', 'Users', '%5Csomeone'].join(''),
    ['', 'c', 'Users', 'someone', 'x'].join('/'),
  ];
  for (const spelling of spellings) {
    assert.deepEqual(rules(scrub([{ path: 'a.ts', text: `p = "${spelling}"` }], [])), [
      'windows-user-path',
    ]);
  }
  const others = [
    TOOLS_PATH,
    ['', 'home', 'someone', 'x'].join('/'),
    ['', 'Users', 'someone', ''].join('/'),
  ];
  for (const other of others) {
    assert.deepEqual(rules(scrub([{ path: 'a.ts', text: `p = "${other}"` }], [])), ['local-path']);
  }
  const notPaths = ['https://example.com/a/b', 'apps/desktop/src', 'see ./Users/x', 'C:/Tools'];
  for (const text of notPaths) {
    assert.deepEqual(scrub([{ path: 'a.ts', text }], []), [], text);
  }
});

test('the email allow list', () => {
  const allowed = [
    OWNER_EMAIL,
    ['a', 'example.com'].join('@'),
    ['a', 'mail.example.org'].join('@'),
    ['a', 'corp.example'].join('@'),
    ['a', 'box.test'].join('@'),
    ['a', 'x.invalid'].join('@'),
    ['a', 'app.localhost'].join('@'),
    ['wordmark', '2x.png'].join('@'),
  ];
  for (const address of allowed) {
    assert.equal(isAllowedEmail(address, address, 0), true, address);
  }
  const userinfo = `http://user:secret@${['proxy', 'acme-widgets.com'].join('.')}:8080`;
  assert.deepEqual(scrub([{ path: 'a.ts', text: userinfo }], []), []);
  const trailer = `Co-Authored-By: Claude <${TRAILER_EMAIL}>`;
  assert.deepEqual(scrub([{ path: 'a.md', text: trailer }], []), []);
  assert.deepEqual(rules(scrub([{ path: 'a.md', text: `mail ${TRAILER_EMAIL}` }], [])), ['email']);
  assert.deepEqual(rules(scrub([{ path: 'a.md', text: `mail ${OUTSIDE_EMAIL}` }], [])), ['email']);
});

test('a finding carries path, line, rule and the sha256 of the match, never the text', () => {
  const [finding] = scrub([{ path: 'a.ts', text: `k = ${ANTHROPIC_KEY}` }], []);
  assert.deepEqual(Object.keys(finding).sort(), ['line', 'matchHash', 'path', 'rule']);
  assert.equal(finding.matchHash, sha256(ANTHROPIC_KEY));
  assert.equal(JSON.stringify(finding).includes(ANTHROPIC_KEY), false);
});

test('parsePatterns: comments, blanks, case-insensitive, no stateful flags, bad lines by number', () => {
  const { patterns, errors } = parsePatterns(
    ['# comment', '', '  ', 'abc', 'x(', '(?i)abc', '[a-z]:[\\\\/]+users'].join('\r\n'),
  );
  assert.deepEqual(
    patterns.map((p) => [p.line, p.re.flags]),
    [
      [4, 'i'],
      [7, 'i'],
    ],
  );
  assert.deepEqual(errors, [5, 6]);
  assert.equal(patterns[0].re.test('ABC'), true);
  assert.equal(patterns[0].re.test('ABC'), true, 'no lastIndex state between calls');
});

test('baseline: accepted findings pass, extra and stale ones fail, private words never pass', () => {
  const findings = scrub(
    [{ path: 'a.ts', text: `${USER_PATH}\n${USER_PATH}\n${PRIVATE_WORD}` }],
    [new RegExp(PRIVATE_WORD)],
  );
  const entry = {
    file: 'a.ts',
    rule: 'windows-user-path',
    sha256: sha256(USER_PATH.slice(0, -1)),
    count: 2,
    reason: 'fixture',
  };
  assert.deepEqual(validateBaseline([entry]), []);
  const ok = compareWithBaseline(findings, [entry]);
  assert.deepEqual(rules(ok.fresh), ['private:1']);
  assert.deepEqual(ok.stale, []);
  const tooFew = compareWithBaseline(findings, [{ ...entry, count: 1 }]);
  assert.deepEqual(rules(tooFew.fresh), ['private:1', 'windows-user-path']);
  const stale = compareWithBaseline(findings, [{ ...entry, count: 3 }]);
  assert.equal(stale.stale.length, 1);
  assert.equal(stale.stale[0].found, 2);
  const invalid = validateBaseline([
    { ...entry, file: 'p.ts', rule: 'private:1' },
    { ...entry, file: 's.ts', sha256: 'xyz' },
    { ...entry, file: 'c.ts', count: 0 },
    { ...entry, file: 'r.ts', reason: ' ' },
    entry,
    entry,
  ]);
  assert.deepEqual(
    invalid.map((p) => p.replace(/^entry \d+ \(\S+ \S+\): /, '')),
    [
      'rule cannot be baselined',
      'sha256 must be 64 lower-case hex characters',
      'count must be a positive integer',
      'no reason',
      'listed twice',
    ],
  );
  assert.equal(invalid.join('\n').includes(USER_PATH), false);
});

test('parseAddedLines reads hunk numbers, renames, quoted paths and deletions', () => {
  const diff = [
    'diff --git a/src/a.ts b/src/a.ts',
    'index 1..2 100644',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -3,0 +4,2 @@ ctx',
    '+four',
    '+five',
    '@@ -9 +11 @@',
    '-old',
    '+eleven',
    'diff --git a/old.md b/new.md',
    'similarity index 90%',
    'rename from old.md',
    'rename to new.md',
    '--- a/old.md',
    '+++ b/new.md',
    '@@ -1,0 +2 @@',
    '+two',
    'diff --git "a/d\\303\\251j\\303\\240.txt" "b/d\\303\\251j\\303\\240.txt"',
    '--- "a/d\\303\\251j\\303\\240.txt"',
    '+++ "b/d\\303\\251j\\303\\240.txt"',
    '@@ -0,0 +1 @@',
    '+one',
    'diff --git a/gone.ts b/gone.ts',
    '--- a/gone.ts',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-bye',
    '',
  ].join('\n');
  const added = parseAddedLines(diff);
  assert.deepEqual(Object.fromEntries([...added].map(([f, ls]) => [f, ls.map((l) => l.line)])), {
    'src/a.ts': [4, 5, 11],
    'new.md': [2],
    'déjà.txt': [1],
  });
  assert.equal(added.get('src/a.ts')[2].text, 'eleven');
});

test('parseAddedLines: inside a hunk every line is content, even one shaped like a header', () => {
  const diff = [
    'diff --git a/notes.md b/notes.md',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/notes.md',
    '@@ -0,0 +1,3 @@',
    '+intro',
    '+++ counter',
    '+after',
    'diff --git a/old.md b/old.md',
    '--- a/old.md',
    '+++ b/old.md',
    '@@ -2,2 +2 @@',
    '---- dashes',
    '-x',
    '\\ No newline at end of file',
    '+kept',
    '',
  ].join('\n');
  const added = parseAddedLines(diff);
  assert.deepEqual([...added.keys()], ['notes.md', 'old.md']);
  assert.deepEqual(added.get('notes.md'), [
    { line: 1, text: 'intro' },
    { line: 2, text: '++ counter' },
    { line: 3, text: 'after' },
  ]);
  assert.deepEqual(added.get('old.md'), [{ line: 2, text: 'kept' }]);
});

test('parseAddedLines drops the TAB git appends to a header name with a space', () => {
  const diff = [
    'diff --git a/my notes.md b/my notes.md',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/my notes.md\t',
    '@@ -0,0 +1 @@',
    '+one',
    '',
  ].join('\n');
  assert.deepEqual([...parseAddedLines(diff).keys()], ['my notes.md']);
});

test('readForkBase takes the 40-character sha from the Base line', () => {
  const sha = 'a'.repeat(40);
  assert.equal(readForkBase(`# x\n\nBase: \`up/repo\` main at \`${sha}\` (2026-10-26).\n`), sha);
  assert.equal(readForkBase('# x\nno base here\n'), null);
});

test('scrubHistory checks identity, message lines and added lines', () => {
  const commits = [
    {
      sha: 'c'.repeat(40),
      an: 'owner',
      ae: OWNER_EMAIL,
      cn: 'owner',
      ce: OWNER_EMAIL,
      body: `Subject\n\nCo-Authored-By: Claude <${TRAILER_EMAIL}>\n`,
      added: new Map([['src/a.ts', [{ line: 1, text: 'clean' }]]]),
    },
    {
      sha: 'd'.repeat(40),
      an: 'someone',
      ae: OUTSIDE_EMAIL,
      cn: 'owner',
      ce: OWNER_EMAIL,
      body: `Subject\n\nwrite to ${OUTSIDE_EMAIL}\n`,
      added: new Map([
        ['src/b.ts', [{ line: 7, text: `const w = '${PRIVATE_WORD}';` }]],
        ['docs/legal/x.txt', [{ line: 1, text: OUTSIDE_EMAIL }]],
      ]),
    },
  ];
  const findings = scrubHistory(commits, [new RegExp(PRIVATE_WORD)]);
  assert.deepEqual(
    findings.map((f) => `${f.sha[0]} ${f.where} ${f.rule}`),
    ['d author identity', 'd message:3 email', 'd src/b.ts:7 private:1'],
  );
});

test('scrubHistory: a private key block in a commit message is reported on its BEGIN line', () => {
  const commits = [
    {
      sha: 'e'.repeat(40),
      an: 'owner',
      ae: OWNER_EMAIL,
      cn: 'owner',
      ce: OWNER_EMAIL,
      body: `Subject\n\npasted by mistake:\n${PEM_BLOCK}\n`,
      added: new Map(),
    },
  ];
  const findings = scrubHistory(commits);
  assert.deepEqual(
    findings.map((f) => `${f.where} ${f.rule}`),
    ['message:4 private-key-block'],
  );
  assert.equal(findings[0].matchHash.length, 64);
  assert.equal(JSON.stringify(findings).includes('M'.repeat(64)), false);
});

const HISTORY_ENTRY = {
  commit: 'fork: c',
  where: 'message:3',
  rule: 'email',
  sha256: sha256(OUTSIDE_EMAIL),
  reason: 'public upstream address',
};

test('history baseline entries: email only, with commit subject, location, hash and reason', () => {
  assert.deepEqual(validateHistoryBaseline([HISTORY_ENTRY]), []);
  const invalid = validateHistoryBaseline([
    { ...HISTORY_ENTRY, commit: ' ' },
    { ...HISTORY_ENTRY, where: 'message' },
    { ...HISTORY_ENTRY, rule: 'identity' },
    { ...HISTORY_ENTRY, rule: 'windows-user-path' },
    { ...HISTORY_ENTRY, sha256: 'xyz' },
    { ...HISTORY_ENTRY, where: 'message:9', reason: '' },
    HISTORY_ENTRY,
    HISTORY_ENTRY,
  ]);
  assert.deepEqual(
    invalid.map((p) => p.replace(/^entry \d+ \(\S+ \S+\): /, '')),
    [
      'no commit subject',
      'where must be <path>:<line> or message:<line>',
      'only the email rule can be accepted in history',
      'only the email rule can be accepted in history',
      'sha256 must be 64 lower-case hex characters',
      'no reason',
      'listed twice',
    ],
  );
});

test('history baseline: an entry accepts its one line in its one commit; unmatched entries are stale', () => {
  const commits = [
    {
      sha: 'f'.repeat(40),
      an: 'someone',
      ae: OUTSIDE_EMAIL,
      cn: 'owner',
      ce: OWNER_EMAIL,
      body: `fork: c\n\nask ${OUTSIDE_EMAIL}\nor ${OUTSIDE_EMAIL}\n`,
      added: new Map([['src/c.ts', [{ line: 1, text: `// ${OUTSIDE_EMAIL}` }]]]),
    },
  ];
  const findings = scrubHistory(commits);
  const entries = [
    HISTORY_ENTRY,
    { ...HISTORY_ENTRY, where: 'src/c.ts:1' },
    { ...HISTORY_ENTRY, where: 'message:4', commit: 'fork: another commit' },
    { ...HISTORY_ENTRY, where: 'message:4', sha256: sha256('other') },
  ];
  const { fresh, accepted, stale } = compareWithHistoryBaseline(findings, entries, commits);
  assert.deepEqual(
    fresh.map((f) => `${f.where} ${f.rule}`),
    ['author identity', 'message:4 email'],
  );
  assert.equal(accepted, 2);
  assert.deepEqual(
    stale.map((s) => s.index),
    [3, 4],
  );
});

// ---------------------------------------------------------------------------
// CLI, on temporary git repositories built here (never this repository's history).

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-scrub-'));
  const globalConfig = path.join(root, 'gitconfig');
  fs.writeFileSync(globalConfig, '');
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_AUTHOR_NAME: 'owner',
    GIT_AUTHOR_EMAIL: OWNER_EMAIL,
    GIT_COMMITTER_NAME: 'owner',
    GIT_COMMITTER_EMAIL: OWNER_EMAIL,
  };
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo);
  return { root, repo, env };
}

function git(ctx, args, extraEnv = {}) {
  const result = spawnSync('git', args, {
    cwd: ctx.repo,
    env: { ...ctx.env, ...extraEnv },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

function write(ctx, rel, text) {
  const full = path.join(ctx.repo, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function commitAll(ctx, message, extraEnv = {}) {
  git(ctx, ['add', '-A']);
  git(ctx, ['commit', '-q', '-m', message], extraEnv);
  return git(ctx, ['rev-parse', 'HEAD']);
}

/** A repo whose base commit holds upstream text; FORK-CHANGES.md names that base. */
function forkRepo(t) {
  const ctx = tempRoot();
  t.after(() => fs.rmSync(ctx.root, { recursive: true, force: true }));
  git(ctx, ['init', '-q']);
  write(ctx, 'README.md', `# upstream\nInstall to ${TOOLS_PATH} or mail ${OUTSIDE_EMAIL}\n`);
  write(ctx, 'LICENSE', `licence text ${OUTSIDE_EMAIL}\n`);
  write(ctx, 'src/app.ts', 'export const a = 1;\n');
  ctx.base = commitAll(ctx, 'upstream base');
  write(
    ctx,
    'FORK-CHANGES.md',
    `# Fork changes\n\nBase: \`up/repo\` main at \`${ctx.base}\` (2026-10-26).\n`,
  );
  write(ctx, '.gitignore', '.scrub-patterns*\n!.scrub-patterns.example\n');
  commitAll(ctx, 'fork: record the base');
  return ctx;
}

function run(ctx, args = []) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ctx.repo,
    env: ctx.env,
    encoding: 'utf8',
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

test('CLI: a clean fork exits 0; upstream lines with a path or an email do not count', (t) => {
  const ctx = forkRepo(t);
  const { code, out } = run(ctx);
  assert.equal(code, 0, out);
  assert.match(out, /built-in rules only/);
  assert.match(out, /^0 findings; 4 files scanned, 1 skipped$/m);
});

test('CLI: a key, a fork-added path and a private word fail without printing them', (t) => {
  const ctx = forkRepo(t);
  write(ctx, 'src/app.ts', `export const a = 1;\nexport const k = '${ANTHROPIC_KEY}';\n`);
  write(
    ctx,
    'README.md',
    `# upstream\nInstall to ${TOOLS_PATH} or mail ${OUTSIDE_EMAIL}\nSee ${USER_PATH}\n`,
  );
  write(ctx, 'notes.md', `ship it to ${PRIVATE_WORD}\n`);
  write(ctx, '.scrub-patterns', `# private\n${PRIVATE_WORD}\n`);
  commitAll(ctx, 'fork: work');
  const { code, out } = run(ctx);
  assert.equal(code, 1, out);
  const findingLines = out.split(/\r?\n/).filter((l) => /^\S+:\d+ \S+$/.test(l));
  assert.deepEqual(findingLines.sort(), [
    'README.md:3 windows-user-path',
    'notes.md:1 private:2',
    'src/app.ts:2 anthropic-key',
  ]);
  for (const secret of [ANTHROPIC_KEY, PRIVATE_WORD, USER_PATH, 'someone']) {
    assert.equal(out.includes(secret), false, 'output must not carry the matched text');
  }
  assert.match(out, /1 private pattern\(s\)/);
});

/** Fork-added files the diff parser used to lose: a '++ ' content line, a spaced name, a NUL. */
function writeAwkwardFiles(ctx, secondLine) {
  write(
    ctx,
    'notes.md',
    ['intro', secondLine, `mail ${OUTSIDE_EMAIL}`, `see ${USER_PATH}`, ''].join('\n'),
  );
  write(ctx, 'my notes.md', `mail ${OUTSIDE_EMAIL}\n`);
  write(
    ctx,
    'src/sep.ts',
    [
      "export const sep = '\u0000';",
      `export const home = '${USER_PATH}';`,
      `// ${OUTSIDE_EMAIL}`,
      '',
    ].join('\n'),
  );
}

test('CLI: added lines count after a "++ " content line, in a spaced name and in a NUL file', (t) => {
  const ctx = forkRepo(t);
  writeAwkwardFiles(ctx, '++ counter');
  commitAll(ctx, 'fork: awkward files');
  const { code, out } = run(ctx);
  assert.equal(code, 1, out);
  const findingLines = out.split(/\r?\n/).filter((l) => / (?:email|windows-user-path)$/.test(l));
  assert.deepEqual(findingLines.sort(), [
    'my notes.md:1 email',
    'notes.md:3 email',
    'notes.md:4 windows-user-path',
    'src/sep.ts:2 windows-user-path',
    'src/sep.ts:3 email',
  ]);
});

test('CLI --history: the same files are read line by line; a "++ " line is content, never a path', (t) => {
  const ctx = forkRepo(t);
  writeAwkwardFiles(ctx, `++ ${PRIVATE_WORD} on this line`);
  const sha = commitAll(ctx, 'fork: awkward files');
  write(ctx, '.scrub-patterns', `${PRIVATE_WORD}\n`);
  const { code, out } = run(ctx, ['--history']);
  assert.equal(code, 1, out);
  const short = sha.slice(0, 9);
  const findingLines = out.split(/\r?\n/).filter((l) => l.startsWith(short));
  assert.deepEqual(findingLines.sort(), [
    `${short} my notes.md:1 email`,
    `${short} notes.md:2 private:1`,
    `${short} notes.md:3 email`,
    `${short} notes.md:4 windows-user-path`,
    `${short} src/sep.ts:2 windows-user-path`,
    `${short} src/sep.ts:3 email`,
  ]);
  for (const leaked of ['on this line', PRIVATE_WORD, '\t']) {
    assert.equal(out.includes(leaked), false, 'output must not carry line content or a TAB');
  }
});

test('CLI: a bad pattern line exits 2 and names the line, not the pattern', (t) => {
  const ctx = forkRepo(t);
  write(ctx, '.scrub-patterns', `# private\n\n${PRIVATE_WORD}(\n`);
  const { code, out } = run(ctx);
  assert.equal(code, 2, out);
  assert.match(out, /\.scrub-patterns:3: not a valid regular expression/);
  assert.equal(out.includes(PRIVATE_WORD), false);
});

test('CLI: an unresolved base exits 2', (t) => {
  const ctx = forkRepo(t);
  const { code, out } = run(ctx, ['--base', 'f'.repeat(40)]);
  assert.equal(code, 2, out);
  assert.match(out, /does not resolve/);
});

test('CLI: a tracked file missing from the work tree is skipped and reported', (t) => {
  const ctx = forkRepo(t);
  fs.rmSync(path.join(ctx.repo, 'src', 'app.ts'));
  const { code, out } = run(ctx);
  assert.equal(code, 0, out);
  assert.match(out, /^src\/app\.ts: skipped, not in the working tree$/m);
  assert.match(out, /^0 findings; 3 files scanned, 2 skipped$/m);
});

test('CLI: a baselined fixture passes; a stale entry fails', (t) => {
  const ctx = forkRepo(t);
  write(ctx, 'src/app.test.ts', `const home = '${USER_PATH}';\n`);
  const entry = {
    file: 'src/app.test.ts',
    rule: 'windows-user-path',
    sha256: sha256(USER_PATH.slice(0, -1)),
    count: 1,
    reason: 'fixture',
  };
  const baselinePath = 'scripts/countersign/scrub-baseline.json';
  write(ctx, baselinePath, JSON.stringify({ entries: [entry] }));
  commitAll(ctx, 'fork: fixture');
  assert.equal(run(ctx).code, 0);
  write(ctx, baselinePath, JSON.stringify({ entries: [{ ...entry, count: 2 }] }));
  const { code, out } = run(ctx);
  assert.equal(code, 1, out);
  assert.match(out, /src\/app\.test\.ts windows-user-path: baseline entry found 1 of 2 time\(s\)/);
});

test('CLI --history: clean commits pass; identity, message email and private words fail', (t) => {
  const ctx = forkRepo(t);
  write(ctx, 'src/b.ts', 'export const b = 2;\n');
  commitAll(ctx, `fork: b\n\nCo-Authored-By: Claude <${TRAILER_EMAIL}>`);
  const clean = run(ctx, ['--history']);
  assert.equal(clean.code, 0, clean.out);
  assert.match(clean.out, /^0 findings; 2 commits scanned$/m);

  write(ctx, 'src/c.ts', `export const c = '${PRIVATE_WORD}';\n`);
  const sha = commitAll(ctx, `fork: c\n\nask ${OUTSIDE_EMAIL}`, {
    GIT_AUTHOR_NAME: 'someone',
    GIT_AUTHOR_EMAIL: OUTSIDE_EMAIL,
  });
  write(ctx, '.scrub-patterns', `${PRIVATE_WORD}\n`);
  const { code, out } = run(ctx, ['--history']);
  assert.equal(code, 1, out);
  const short = sha.slice(0, 9);
  const findingLines = out.split(/\r?\n/).filter((l) => l.startsWith(short));
  assert.deepEqual(findingLines, [
    `${short} author identity`,
    `${short} message:3 email`,
    `${short} src/c.ts:1 private:1`,
  ]);
  for (const secret of [OUTSIDE_EMAIL, PRIVATE_WORD, 'someone']) {
    assert.equal(out.includes(secret), false, 'output must not carry the matched text');
  }
});

test('CLI --history: a private key block pasted into a commit message fails', (t) => {
  const ctx = forkRepo(t);
  write(ctx, 'src/d.ts', 'export const d = 4;\n');
  const sha = commitAll(ctx, `fork: d\n\n${PEM_BLOCK}`);
  const { code, out } = run(ctx, ['--history']);
  assert.equal(code, 1, out);
  const short = sha.slice(0, 9);
  const findingLines = out.split(/\r?\n/).filter((l) => l.startsWith(short));
  assert.deepEqual(findingLines, [`${short} message:3 private-key-block`]);
  assert.equal(out.includes('M'.repeat(64)), false, 'output must not carry the key body');
});

test('CLI --history: listed email findings pass; a stale or invalid history entry fails', (t) => {
  const ctx = forkRepo(t);
  write(ctx, 'src/c.ts', `// mail ${OUTSIDE_EMAIL}\n`);
  const sha = commitAll(ctx, `fork: c\n\nask ${OUTSIDE_EMAIL}`);
  const short = sha.slice(0, 9);
  const baselinePath = 'scripts/countersign/scrub-history-baseline.json';
  const entries = [HISTORY_ENTRY, { ...HISTORY_ENTRY, where: 'src/c.ts:1' }];
  write(ctx, baselinePath, JSON.stringify({ entries }));
  const ok = run(ctx, ['--history']);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /^0 findings; 2 commits scanned$/m);
  assert.match(ok.out, /^2 findings accepted by the history baseline$/m);

  write(
    ctx,
    baselinePath,
    JSON.stringify({ entries: [HISTORY_ENTRY, { ...entries[1], where: 'src/c.ts:2' }] }),
  );
  const stale = run(ctx, ['--history']);
  assert.equal(stale.code, 1, stale.out);
  assert.match(stale.out, new RegExp(`^${short} src/c\.ts:1 email$`, 'm'));
  assert.match(
    stale.out,
    /^history baseline entry 2 \(src\/c\.ts:2 email\): matches no finding; remove it$/m,
  );
  assert.match(stale.out, /^2 findings; 2 commits scanned$/m);

  write(ctx, baselinePath, JSON.stringify({ entries: [{ ...HISTORY_ENTRY, rule: 'identity' }] }));
  const invalid = run(ctx, ['--history']);
  assert.equal(invalid.code, 1, invalid.out);
  assert.match(
    invalid.out,
    /scrub history baseline: entry 1 \(message:3 identity\): only the email rule can be accepted in history/,
  );
  for (const out of [ok.out, stale.out, invalid.out]) {
    assert.equal(out.includes(OUTSIDE_EMAIL), false, 'output must not carry the matched text');
  }
});
