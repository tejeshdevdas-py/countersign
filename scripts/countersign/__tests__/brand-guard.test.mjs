import assert from 'node:assert/strict';
import test from 'node:test';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROMPT_SOURCE_FILES,
  findBrandAssetNames,
  findBrandLeaks,
  findPromptLeaks,
  isPromptTemplatePath,
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
  assert.equal(findBrandLeaks([{ path: 'apps/desktop/src/renderer/lib/wallpaper.ts', text }]).length, 1);
});

// Prompt text: a model repeats what Countersign sends it, so the old name there is user-visible.

test('flags the old name on any line of a prompt template', () => {
  const text = 'You are Cindy, an open-source AI assistant.\n\nKeep tasks in Countersign.\n';
  const leaks = findPromptLeaks([{ path: 'apps/desktop/src/main/maker-host/host-system-prompt.md', text }]);
  assert.deepEqual(leaks.map((leak) => [leak.line, leak.match]), [[1, 'Cindy']]);
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
  assert.equal(isPromptTemplatePath('apps/desktop/resources/system-skills/cindy-skill-creator/scripts/init_skill.py'), false);
  assert.equal(isPromptTemplatePath('packages/lizi-mcps/src/computer/README.md'), false);
});

test('keeps the quoted browser profile name but flags prose in the browser workflow prompt', () => {
  const p = 'packages/lizi-mcps/src/browser/prompts/rules/browser-workflow.md';
  const text = '外置浏览器默认也是独立的 `Cindy` profile(profile 显示为 "Cindy")。\n页面活在 Cindy 的侧边栏里。\n';
  assert.deepEqual(findPromptLeaks([{ path: p, text }]).map((leak) => leak.line), [2]);
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
  assert.deepEqual(leaks.map((leak) => leak.line), [4, 6]);
});

test('does not scan TS files outside the prompt source list', () => {
  const text = "throw new Error('Cindy Review requires Codex 0.145');\n";
  assert.deepEqual(findPromptLeaks([{ path: 'packages/maker-core/src/agents/codex/index.ts', text }]), []);
});

test('every listed prompt source exists', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  for (const rel of PROMPT_SOURCE_FILES) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
});
