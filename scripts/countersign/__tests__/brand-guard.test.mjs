import assert from 'node:assert/strict';
import test from 'node:test';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BASELINE_CATEGORIES,
  PROMPT_SOURCE_FILES,
  UPSTREAM_REF_EXEMPT,
  compareUpstreamRefs,
  compareWithBaseline,
  findBrandAssetNames,
  findBrandLeaks,
  findHtmlLeaks,
  findModelDataLeaks,
  findPromptLeaks,
  findUpstreamRefs,
  findUserTextHits,
  isPromptTemplatePath,
  isUserTextSourcePath,
  loadBaseline,
  main,
  validateBaseline,
} from '../brand-guard.mjs';

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

test('flags the capitalised CINDY in a locale value', () => {
  const text = '{\n  "a": "CINDY Light"\n}\n';
  assert.equal(findBrandLeaks([{ path: LOCALE, text }]).length, 1);
});

test('flags literal names and alt text in renderer source', () => {
  const text = [
    "  name: 'CINDY Light',",
    "  name: 'Cindy',",
    '<img alt="Cindy" />',
    '<button aria-label="Cindy" />',
  ].join('\n');
  const leaks = findBrandLeaks([{ path: 'apps/desktop/src/renderer/themes/x.ts', text }]);
  assert.deepEqual(
    leaks.map((leak) => leak.line),
    [1, 2, 3, 4],
  );
});

test('leaves internal names in main-process source alone', () => {
  const text = "clientInfo: { name: 'Cindy', version: '1' },\n";
  assert.deepEqual(findBrandLeaks([{ path: 'apps/desktop/src/main/x.ts', text }]), []);
});

test('flags imports of the Cindy artwork in renderer source', () => {
  const text = [
    "import logoLight from '@/assets/logo-light.png';",
    "import head from '@/assets/head-image-dark.png';",
    "import portrait from '@/assets/bot-presets/cindy.png';",
    "import cindyLogoDark from '../../assets/cindy-logo-dark.png';",
    "import mark from '@/assets/countersign/lockup-avatar.png';",
    "import share from '@/assets/cindy-share-character.jpg';",
    "import account from '@/assets/cindy-avatar-account.png?url';",
  ].join('\n');
  const leaks = findBrandLeaks([{ path: 'apps/desktop/src/renderer/hooks/x.ts', text }]);
  assert.deepEqual(
    leaks.map((leak) => leak.line),
    [1, 2, 3, 4, 6, 7],
  );
});

test('flags shipped wallpaper and asset files named after Cindy', () => {
  const leaks = findBrandAssetNames([
    'apps/desktop/src/renderer/assets/wallpapers/thumbnails/cindy-neon.webp',
    'apps/desktop/src/renderer/assets/wallpapers/cindy-window.mp4',
    'apps/desktop/resources/companion-preset-avatars/cindy.png',
    'apps/desktop/src/renderer/assets/wallpapers/thumbnails/night-launch.webp',
    'apps/desktop/src/renderer/assets/bot-presets/cindy.png',
    'apps/desktop/resources/cindy-version-protocol.json',
  ]);
  assert.deepEqual(
    leaks.map((leak) => leak.match),
    ['cindy-neon.webp', 'cindy-window.mp4', 'cindy.png'],
  );
});

test('flags renderer imports of Cindy wallpaper images', () => {
  const text = "import cindyNeon from '@/assets/wallpapers/thumbnails/cindy-neon.webp';\n";
  assert.equal(
    findBrandLeaks([{ path: 'apps/desktop/src/renderer/lib/wallpaper.ts', text }]).length,
    1,
  );
});

// (10) Shipped .html entry pages: the page <title> overrides the window title (taskbar, Alt+Tab).

const RENDERER_HTML = 'apps/desktop/src/renderer/index.html';

test('flags the old name in the <title> of a shipped html entry page', () => {
  const text = '<!DOCTYPE html>\n<html>\n  <head>\n    <title>Cindy</title>\n  </head>\n</html>\n';
  const leaks = findHtmlLeaks([{ path: RENDERER_HTML, text }]);
  assert.deepEqual(
    leaks.map((leak) => [leak.line, leak.match]),
    [[4, 'Cindy']],
  );
});

test('flags visible html text and alt, title, aria-label and placeholder values', () => {
  const text = [
    '<body>',
    '  <p>Welcome to Cindy</p>',
    '  <img src="./a.png" alt="Cindy logo" />',
    '  <button aria-label="Open Cindy"></button>',
    '  <input placeholder="Ask Cindy" title="Cindy" />',
    '</body>',
  ].join('\n');
  const leaks = findHtmlLeaks([{ path: 'apps/desktop/resources/page.html', text }]);
  assert.deepEqual(
    leaks.map((leak) => leak.line),
    [2, 3, 4, 5, 5],
  );
});

test('ignores html scripts, styles, comments, ids and paths', () => {
  const text = [
    '<!-- Cindy shell -->',
    '<style>.Cindy { color: red; }</style>',
    '<script>window.Cindy = 1;</script>',
    '<div id="cindy-root" data-name="Cindy"></div>',
    '<script type="module" src="./cindy.tsx"></script>',
    '<title>Countersign</title>',
  ].join('\n');
  assert.deepEqual(findHtmlLeaks([{ path: RENDERER_HTML, text }]), []);
});

test('scans html entry pages under apps/desktop/src and resources only, not test fixtures', () => {
  const text = '<title>Cindy</title>\n';
  const paths = [
    'apps/desktop/src/capture-renderer/index.html',
    'apps/desktop/resources/help/index.html',
    'apps/desktop/src/main/cindy-brain/__tests__/fixtures/page/settings.html',
    'apps/desktop/cindy-updater/ui/index.html',
    'apps/desktop/scripts/fixtures/page.html',
  ];
  const leaks = findHtmlLeaks(paths.map((p) => ({ path: p, text })));
  assert.deepEqual(
    leaks.map((leak) => leak.path),
    ['apps/desktop/src/capture-renderer/index.html', 'apps/desktop/resources/help/index.html'],
  );
});

// (11) JSON data the model reads: browser recipes and site guides go to the model whole.

const SITEGUIDE = 'packages/lizi-mcps/src/browser/cindy-recipes/openlibrary.org/siteguide.json';

test('flags the old name in any string of the bundled recipe and site guide JSON', () => {
  const text = [
    '{',
    '  "site": "openlibrary.org",',
    '  "notes": "公开书目。\\n完整目录更新时保留此 Cindy 独立配方。",',
    '  "source": "Cindy",',
    '  "aliases": ["open-library", "Cindy books"]',
    '}',
  ].join('\n');
  const leaks = findModelDataLeaks([{ path: SITEGUIDE, text }]);
  assert.deepEqual(
    leaks.map((leak) => [leak.line, leak.match]),
    [
      [3, 'Cindy'],
      [4, 'Cindy'],
      [5, 'Cindy'],
    ],
  );
});

test('scans recipe and site guide JSON under recipes and cindy-recipes only', () => {
  const text = '{ "source": "Cindy" }\n';
  const paths = [
    'packages/lizi-mcps/src/browser/recipes/bbc.com/siteguide.json',
    'packages/lizi-mcps/src/browser/recipes/bbc.com/recipe.json',
    'packages/lizi-mcps/src/browser/cindy-recipes/apps.apple.com/app-store-search.recipe.json',
    'packages/lizi-mcps/src/browser/recipe-examples/books.toscrape.com/siteguide.json',
    'packages/lizi-mcps/package.json',
  ];
  const leaks = findModelDataLeaks(paths.map((p) => ({ path: p, text })));
  assert.deepEqual(
    leaks.map((leak) => leak.path),
    paths.slice(0, 3),
  );
});

// Prompt text: a model repeats what Countersign sends it, so the old name there is user-visible.

test('flags the old name on any line of a prompt template', () => {
  const text = 'You are Cindy, an open-source AI assistant.\n\nKeep tasks in Countersign.\n';
  const leaks = findPromptLeaks([
    { path: 'apps/desktop/src/main/maker-host/host-system-prompt.md', text },
  ]);
  assert.deepEqual(
    leaks.map((leak) => [leak.line, leak.match]),
    [[1, 'Cindy']],
  );
});

test('covers built-in Skills, teammate packages and headless profiles', () => {
  for (const p of [
    'apps/desktop/resources/system-skills/learn/SKILL.md',
    'apps/desktop/resources/system-skills/learn/agents/openai.yaml',
    'apps/desktop/resources/bot-packages/cooper/0.5.2/manifest.json',
    'apps/desktop/resources/bot-packages/cooper/0.5.2/skills/cooper-ops/SKILL.md',
    'apps/cindy-headless/profiles/cindy-production-codex/prompt.md',
    'packages/lizi-mcps/src/browser/prompts/rules/browser-workflow.md',
    'packages/maker-core/src/contacts/system-prompt-disabled.md',
  ]) {
    assert.equal(isPromptTemplatePath(p), true, p);
  }
  assert.equal(
    isPromptTemplatePath(
      'apps/desktop/resources/system-skills/cindy-skill-creator/scripts/init_skill.py',
    ),
    false,
  );
  assert.equal(isPromptTemplatePath('packages/lizi-mcps/src/computer/README.md'), false);
});

test('flags the quoted browser profile name too: the Chrome chip shows the product name', () => {
  const p = 'packages/lizi-mcps/src/browser/prompts/rules/browser-workflow.md';
  const text =
    '外置浏览器默认也是独立的 `Cindy` profile(profile 显示为 "Cindy")。\n页面活在 Cindy 的侧边栏里。\n';
  assert.deepEqual(
    findPromptLeaks([{ path: p, text }]).map((leak) => leak.line),
    [1, 2],
  );
});

test('scans every string literal of a listed prompt source, not its comments or ids', () => {
  const p = 'packages/maker-shared/src/richAnswerGuide.ts';
  const text = [
    '// Cindy renders this guide.',
    "const server = 'cindy_helper';",
    "const begin = 'Cindy.begin';",
    'export const GUIDE = `## Countersign answer delivery',
    "within Cindy's colors`;",
    "export const TOOL = { description: 'Ask in Cindy cards' };",
  ].join('\n');
  const leaks = findPromptLeaks([{ path: p, text }]);
  assert.deepEqual(
    leaks.map((leak) => leak.line),
    [4, 6],
  );
});

test('does not scan TS files outside the prompt source list', () => {
  const text = "throw new Error('Cindy Review requires Codex 0.145');\n";
  assert.deepEqual(
    findPromptLeaks([{ path: 'packages/maker-core/src/agents/codex/index.ts', text }]),
    [],
  );
});

test('every listed prompt source exists', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  for (const rel of PROMPT_SOURCE_FILES) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
});

// (12) Upstream addresses and the upstream company's name in locale strings and
// prompt text, in any case and inside URLs too.

const HOST_PROMPT = 'apps/desktop/src/main/maker-host/host-system-prompt.md';

function refs(hits) {
  return hits.map((h) => `${h.path}:${h.line} ${h.token}`);
}

test('flags upstream addresses and the company name in prompt text, in any case and in URLs', () => {
  const text = [
    'You are Countersign, an open-source AI assistant.',
    'Source: https://github.com/makecindy/cindy',
    'Sites: https://Cindy.App and www.cindy.cn',
    'Mirror: cindy.com.cn. Made by XD Inc.',
    'Source: https://github.com/tejeshdevdas-py/countersign',
    'A cindy.application or cindy.cnx is not an upstream address.',
  ].join('\n');
  assert.deepEqual(refs(findUpstreamRefs([{ path: HOST_PROMPT, text }])), [
    `${HOST_PROMPT}:2 makecindy`,
    `${HOST_PROMPT}:3 cindy.app`,
    `${HOST_PROMPT}:3 cindy.cn`,
    `${HOST_PROMPT}:4 cindy.com.cn`,
    `${HOST_PROMPT}:4 xd inc`,
  ]);
});

test('upstream references: locale values and prompt source literals; not comments or other files', () => {
  const locale = '{\n  "a": "Mail cindy.app support",\n  "makecindy": "ok"\n}\n';
  const source = [
    '// see https://github.com/makecindy/cindy',
    "export const URL = 'https://github.com/makecindy/cindy';",
  ].join('\n');
  const promptSource = 'packages/maker-shared/src/richAnswerGuide.ts';
  const hits = findUpstreamRefs([
    { path: LOCALE, text: locale },
    { path: promptSource, text: source },
    { path: 'apps/desktop/src/renderer/pages/About.tsx', text: source },
    { path: 'apps/desktop/help-knowledge/about.md', text: 'see cindy.app\n' },
    { path: 'FORK-CHANGES.md', text: 'makecindy\n' },
  ]);
  assert.deepEqual(refs(hits), [`${LOCALE}:2 cindy.app`, `${promptSource}:2 makecindy`]);
});

test('upstream references: listed ones pass, extra ones fail, a listed one that is gone fails', () => {
  const hits = [
    { path: 'a.md', line: 1, token: 'makecindy' },
    { path: 'a.md', line: 3, token: 'makecindy' },
    { path: 'b.md', line: 1, token: 'xd inc' },
  ];
  const exempt = [
    { path: 'a.md', token: 'makecindy', count: 1, reason: 'credit' },
    { path: 'c.md', token: 'cindy.app', count: 1, reason: 'gone' },
  ];
  const { fresh, stale } = compareUpstreamRefs(hits, exempt);
  assert.deepEqual(refs(fresh), ['a.md:3 makecindy', 'b.md:1 xd inc']);
  assert.deepEqual(
    stale.map((e) => `${e.path} ${e.token} ${e.found}`),
    ['c.md cindy.app 0'],
  );
});

test('every upstream-reference exemption names a file, a token, a count and its reason', () => {
  const keys = new Set();
  for (const e of UPSTREAM_REF_EXEMPT) {
    assert.equal(typeof e.path === 'string' && e.path.length > 0, true, JSON.stringify(e));
    assert.match(e.token, /^(?:makecindy|cindy\.(?:com\.cn|app|cn)|xd inc)$/, e.path);
    assert.equal(Number.isInteger(e.count) && e.count >= 1, true, e.path);
    assert.equal(typeof e.reason === 'string' && e.reason.trim().length > 0, true, e.path);
    const key = `${e.path} ${e.token}`;
    assert.equal(keys.has(key), false, `listed twice: ${key}`);
    keys.add(key);
  }
});

test('the shipped host and headless prompts name no upstream address', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const prompts = [
    HOST_PROMPT,
    ...['claude', 'codex', 'pi'].map(
      (engine) => `apps/cindy-headless/profiles/cindy-production-${engine}/prompt.md`,
    ),
  ];
  for (const rel of prompts) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.deepEqual(refs(findUpstreamRefs([{ path: rel, text }])), [], rel);
  }
});

// (9) Every non-test .ts/.tsx under apps/desktop/src and packages/*/src: every string
// literal, template part and JSX text, minus logger calls and identifier tokens; what
// stays is checked against the committed baseline.

const MAIN_FILE = 'apps/desktop/src/main/someService.ts';
const RENDERER_FILE = 'apps/desktop/src/renderer/components/Some.tsx';

function hitLines(path, text) {
  return findUserTextHits([{ path, text }]).map((hit) => hit.line);
}

test('scans every non-test source file under apps/desktop/src and packages/*/src', () => {
  assert.equal(isUserTextSourcePath('apps/desktop/src/main/notificationService.ts'), true);
  assert.equal(
    isUserTextSourcePath('apps/desktop/src/renderer/components/settings/SettingsView.tsx'),
    true,
  );
  assert.equal(isUserTextSourcePath('packages/maker-core/src/agents/pi/index.ts'), true);
  assert.equal(isUserTextSourcePath('packages/lizi-im/src/feishu/messages.ts'), true);
  assert.equal(isUserTextSourcePath('apps/desktop/src/main/__tests__/a.test.ts'), false);
  assert.equal(isUserTextSourcePath('packages/maker-core/src/agents/codex/index.test.ts'), false);
  assert.equal(isUserTextSourcePath('apps/desktop/src/renderer/vite-env.d.ts'), false);
  assert.equal(
    isUserTextSourcePath('apps/desktop/src/main/maker-ipc/helpKnowledge.generated.ts'),
    false,
  );
  assert.equal(isUserTextSourcePath('scripts/countersign/brand-guard.mjs'), false);
  assert.equal(isUserTextSourcePath('apps/cindy-headless/src/gateway-config.ts'), false);
});

test('leaves prompt source files to the prompt check', () => {
  const text = "export const TOOL = { description: 'Ask in Cindy cards' };\n";
  assert.deepEqual(findUserTextHits([{ path: PROMPT_SOURCE_FILES[0], text }]), []);
});

test('flags error text, plain backtick strings and every template part, not comments', () => {
  const text = [
    '// Cindy runs here.',
    "throw new Error('Cindy could not start');",
    'const a = `Cindy is ready`;',
    'const b = `Cindy: ${reason}`;',
    'const c = `${a} asks Cindy ${b} now`;',
    'const d = `${a} then Cindy`;',
  ].join('\n');
  assert.deepEqual(hitLines(MAIN_FILE, text), [2, 3, 4, 5, 6]);
});

test('flags JSX text and JSX attribute strings', () => {
  const text = [
    'export const A = () => (',
    '  <div title="Cindy settings" aria-label={"Open Cindy"}>',
    '    <span>Cindy.</span>',
    '    <input placeholder={`Ask Cindy ${x}`} />',
    '  </div>',
    ');',
  ].join('\n');
  assert.deepEqual(hitLines(RENDERER_FILE, text), [2, 2, 3, 4]);
});

test('flags short name-like literals that the old identifier rule let through', () => {
  const text = [
    "const a = 'Cindy.';",
    "const b = 'Cindy:';",
    "const c = 'Cindy/Codex';",
    "const d = 'Cindy-powered';",
    "const e = 'Cindy';",
  ].join('\n');
  assert.deepEqual(hitLines(MAIN_FILE, text), [1, 2, 3, 4, 5]);
});

test('exempts the old name only inside an identifier token, a path or a URL', () => {
  const text = [
    "const a = 'Cindy.begin';",
    "const b = '/Applications/Cindy.app';",
    "const c = 'C:\\\\Users\\\\me\\\\AppData\\\\Roaming\\\\Cindy';",
    "const d = 'https://example.com/Cindy';",
    "const e = '~/Cindy/data';",
    "const f = 'XDMaker.Cindy';",
    "const g = 'cindy_helper cindy-media @cindy/maker-shared CINDY_HOME';",
    "const h = 'Open Cindy.begin in Cindy now';",
  ].join('\n');
  assert.deepEqual(hitLines(MAIN_FILE, text), [8]);
});

test('a token is a path only when it starts like one or carries a URL scheme', () => {
  const text = [
    "const a = './Cindy/data';",
    "const b = '../Cindy/data';",
    "const c = 'Cindy/Claude/Codex';",
    "const d = 'Teams/Cindy/Codex';",
    "const e = 'Cindy\\\\';",
    "const f = 'see Cindy/x/y';",
  ].join('\n');
  assert.deepEqual(hitLines(MAIN_FILE, text), [3, 4, 5, 6]);
});

test('flags a domain-like name, a mention and run-on prose, but not a URL or a method id', () => {
  const text = [
    "const a = 'Visit Cindy.ai today';",
    "const b = 'Cindy.app';",
    "const c = 'https://Cindy.ai/docs';",
    "const d = '@Cindy';",
    "const e = 'in...Cindy';",
    "const f = 'Cindy.Thanks';",
    "const g = 'Cindy.captureStart';",
    "const h = 'Cindy.end';",
  ].join('\n');
  assert.deepEqual(hitLines(MAIN_FILE, text), [1, 2, 4, 5, 6]);
});

test('skips real logger calls only', () => {
  const text = [
    "log.info('Cindy started');",
    "logger.warn('Cindy slow');",
    "console.error('Cindy failed');",
    "this.log.debug('Cindy trace');",
    "authLogger.error('Cindy auth');",
    "dialog.error('Cindy failed to start');",
    "catalog.error('Cindy catalog');",
    "dbClientLog.warn('Cindy db');",
  ].join('\n');
  assert.deepEqual(hitLines(MAIN_FILE, text), [6, 7, 8]);
});

test('a hit is reported with its file, trimmed literal text and line', () => {
  const hits = findUserTextHits([
    { path: MAIN_FILE, text: "\nthrow new Error('  Cindy failed  ');\n" },
  ]);
  assert.deepEqual(hits, [{ path: MAIN_FILE, line: 2, text: 'Cindy failed', match: 'Cindy' }]);
});

function entry(overrides = {}) {
  return {
    file: MAIN_FILE,
    text: 'Cindy failed',
    count: 1,
    category: 'switched-off',
    why: 'test',
    ...overrides,
  };
}

test('a hit listed in the baseline passes', () => {
  const hits = findUserTextHits([{ path: MAIN_FILE, text: "throw new Error('Cindy failed');\n" }]);
  assert.deepEqual(compareWithBaseline(hits, [entry()]), { fresh: [], stale: [] });
});

test('a new hit fails, and so does one more occurrence of a listed text', () => {
  const one = findUserTextHits([{ path: MAIN_FILE, text: "throw new Error('Cindy broke');\n" }]);
  assert.equal(compareWithBaseline(one, [entry()]).fresh.length, 1);
  const two = findUserTextHits([
    { path: MAIN_FILE, text: "f('Cindy failed');\ng('Cindy failed');\n" },
  ]);
  const result = compareWithBaseline(two, [entry()]);
  assert.equal(result.fresh.length, 1);
  assert.equal(result.fresh[0].line, 2);
});

test('a baseline entry that no longer occurs, or occurs less often, fails', () => {
  assert.equal(compareWithBaseline([], [entry()]).stale.length, 1);
  const one = findUserTextHits([{ path: MAIN_FILE, text: "f('Cindy failed');\n" }]);
  const stale = compareWithBaseline(one, [entry({ count: 2 })]).stale;
  assert.equal(stale.length, 1);
  assert.equal(stale[0].found, 1);
});

test('a baseline entry needs a known category, a reason and a positive count, once per text', () => {
  assert.deepEqual(validateBaseline([entry()]), []);
  assert.equal(validateBaseline([entry({ category: 'because' })]).length, 1);
  assert.equal(validateBaseline([entry({ why: '' })]).length, 1);
  assert.equal(validateBaseline([entry({ count: 0 })]).length, 1);
  assert.equal(validateBaseline([entry(), entry()]).length, 1);
  assert.ok(BASELINE_CATEGORIES.includes('im-later'));
});

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('the committed baseline is valid and holds nothing seen in normal Windows use', () => {
  const baseline = loadBaseline(
    path.join(REPO_ROOT, 'scripts', 'countersign', 'brand-guard-baseline.json'),
  );
  assert.deepEqual(validateBaseline(baseline), []);
  const normalUse = [
    'apps/desktop/src/main/notificationService.ts',
    'apps/desktop/src/main/cindy-brain/fileAssociation.ts',
    'apps/desktop/src/main/rsbBrowserWebAuthnLabels.ts',
    'apps/desktop/src/main/utility-model/resolveAuxiliaryModelChain.ts',
    'apps/desktop/src/renderer/lib/workLouderCodexTaskActions.ts',
    'apps/desktop/src/renderer/components/settings/SettingsView.tsx',
  ];
  for (const e of baseline) {
    assert.equal(normalUse.includes(e.file), false, `${e.file}: ${e.text}`);
    assert.notEqual(e.text, 'Cindy Ghost', e.file);
    assert.equal(fs.existsSync(path.join(REPO_ROOT, e.file)), true, e.file);
  }
});

test('the committed baseline files snapshot authors and client identities under accurate categories', () => {
  const baseline = loadBaseline(
    path.join(REPO_ROOT, 'scripts', 'countersign', 'brand-guard-baseline.json'),
  );
  const categoryOf = (file) =>
    baseline.find((e) => e.file === file && e.text === 'Cindy')?.category;
  // Author of the hidden snapshot commits under refs/cindy/*: shown by git log --all and the reflog.
  for (const file of [
    'apps/desktop/src/main/git-snapshot/gitSnapshotService.ts',
    'apps/desktop/src/main/worktree/contentSnapshot.ts',
  ]) {
    assert.equal(categoryOf(file), 'hidden-history', file);
  }
  // MCP clientInfo name and the MCP app host userAgent: read by another program, which may show it.
  for (const file of [
    'apps/desktop/src/main/cindy-brain/nodeRuntimeBroker.ts',
    'apps/desktop/src/main/mcp-apps/connection.ts',
    'apps/desktop/src/main/mcp-apps/host.ts',
    'apps/desktop/src/renderer/components/chat/McpAppCard.tsx',
  ]) {
    assert.equal(categoryOf(file), 'peer-identity', file);
  }
  // Fixed rather than listed: model-visible plugin refusal and the Pi gateway provider name.
  assert.equal(
    baseline.some((e) => e.file === 'apps/desktop/src/main/cindy-brain/ghostVisibility.ts'),
    false,
  );
  assert.equal(
    baseline.some(
      (e) => e.file === 'packages/maker-core/src/agents/pi/index.ts' && e.text === 'Cindy AI',
    ),
    false,
  );
});

function writeFile(root, rel, text) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function fixtureTree(baselineEntries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-guard-'));
  for (const dir of [
    'apps/desktop/src/renderer/assets',
    'apps/desktop/help-knowledge',
    'apps/desktop/resources/system-skills',
    'apps/desktop/resources/bot-packages',
    'apps/desktop/src/main/maker-host',
    'apps/cindy-headless/profiles',
    'packages/maker-core/src',
    'packages/lizi-mcps/src',
  ]) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  writeFile(root, 'apps/desktop/src/main/ok.ts', "export const a = 'Countersign is ready';\n");
  writeFile(root, 'packages/maker-core/src/old.ts', "throw new Error('Cindy failed');\n");
  writeFile(root, 'packages/maker-core/src/__tests__/old.test.ts', "expect('Cindy failed');\n");
  const baselinePath = path.join(root, 'baseline.json');
  fs.writeFileSync(baselinePath, JSON.stringify({ entries: baselineEntries }));
  return { root, baselinePath };
}

function runMain(baselineEntries, edit, upstreamRefExempt = []) {
  const { root, baselinePath } = fixtureTree(baselineEntries);
  edit?.(root);
  const out = [];
  const code = main({
    root,
    baselinePath,
    promptSourceFiles: [],
    upstreamRefExempt,
    log: (line) => out.push(line),
    error: (line) => out.push(line),
  });
  fs.rmSync(root, { recursive: true, force: true });
  return { code, out: out.join('\n') };
}

const FIXTURE_ENTRY = {
  file: 'packages/maker-core/src/old.ts',
  text: 'Cindy failed',
  count: 1,
  category: 'switched-off',
  why: 'fixture',
};

test('main() passes a fixture tree whose only hit is in the baseline', () => {
  const { code, out } = runMain([FIXTURE_ENTRY]);
  assert.equal(code, 0, out);
  assert.match(out, /brand guard: ok/);
});

test('main() fails a fixture tree with a hit outside the baseline', () => {
  const { code, out } = runMain([FIXTURE_ENTRY], (root) => {
    writeFile(root, 'apps/desktop/src/renderer/New.tsx', 'export const N = () => <b>Cindy.</b>;\n');
  });
  assert.equal(code, 1);
  assert.match(out, /apps\/desktop\/src\/renderer\/New\.tsx:1/);
});

test('main() fails a fixture tree whose html entry page is titled with the old name', () => {
  const { code, out } = runMain([FIXTURE_ENTRY], (root) => {
    writeFile(
      root,
      'apps/desktop/src/renderer/index.html',
      '<html>\n<title>Cindy</title>\n</html>\n',
    );
  });
  assert.equal(code, 1);
  assert.match(out, /apps\/desktop\/src\/renderer\/index\.html:2/);
});

test('main() fails a fixture tree whose site guide names the old name', () => {
  const { code, out } = runMain([FIXTURE_ENTRY], (root) => {
    writeFile(
      root,
      'packages/lizi-mcps/src/browser/cindy-recipes/x.test/siteguide.json',
      '{\n  "source": "Cindy"\n}\n',
    );
  });
  assert.equal(code, 1);
  assert.match(out, /cindy-recipes\/x\.test\/siteguide\.json:2/);
});

test('main() fails a fixture tree whose baseline lists a text that is gone', () => {
  const { code, out } = runMain([FIXTURE_ENTRY], (root) => {
    writeFile(root, 'packages/maker-core/src/old.ts', "throw new Error('Countersign failed');\n");
  });
  assert.equal(code, 1);
  assert.match(out, /no longer occurs/);
});

test('main() fails a fixture tree whose host prompt names the upstream repository', () => {
  const { code, out } = runMain([FIXTURE_ENTRY], (root) => {
    writeFile(
      root,
      HOST_PROMPT,
      'You are Countersign.\nSource: https://github.com/makecindy/cindy\n',
    );
  });
  assert.equal(code, 1);
  assert.match(out, /host-system-prompt\.md:2: upstream reference "makecindy"/);
});

test('main() fails a fixture tree whose upstream-reference exemption no longer occurs', () => {
  const exempt = [{ path: HOST_PROMPT, token: 'makecindy', count: 1, reason: 'fixture' }];
  const { code, out } = runMain([FIXTURE_ENTRY], undefined, exempt);
  assert.equal(code, 1);
  assert.match(out, /upstream reference "makecindy" listed 1 time\(s\), found 0/);
});
